import base64
import json
import asyncio
import httpx
from openai import OpenAI
from typing import Optional, List, Dict

from models.schemas import Message


# 페이지 맥락을 분석하기 위한 프롬프트를 한국어로 생성합니다.
def create_page_analysis_prompt(html_content: str, conversation_history: Optional[List[Message]] = None) -> List[Dict]:
    """
    페이지 맥락 분석을 위한 프롬프트 텍스트를 생성합니다.
    """
    messages = []
    if conversation_history:
        messages.extend([{"role": msg.role, "content": msg.content} for msg in conversation_history])

    messages.append({
        "role": "user",
        "content": (
            "다음 HTML 콘텐츠를 분석하여 이 페이지의 목적과 주요 기능을 파악해 줘. "
            "이 페이지에서 사용자가 무엇을 할 수 있는지 간결하게 요약해 줘. "
            "반드시 답변은 한국어로 해 줘."
            f"HTML 콘텐츠:\n{html_content}"
        )
    })
    return messages


# 이미지에 대체 텍스트를 추가하기 위한 프롬프트를 한국어로 생성합니다.
def create_alt_text_generation_prompt(
        screenshot_base64: str,
        html_content: str,
        image_files: List[bytes]
) -> List[Dict]:
    """
    대체 텍스트 생성을 위한 프롬프트를 구성합니다.
    HTML 문맥과 이미지(Base64)를 모두 포함합니다.
    """
    prompt_images = [
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{screenshot_base64}"}
        }
    ]

    for img_bytes in image_files:
        prompt_images.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode('utf-8')}"}
        })

    return [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "다음 HTML에는 'alt' 속성이 없는 이미지가 포함되어 있어. "
                        "제공된 스크린샷과 HTML을 기반으로 각 이미지에 적합한 대체 텍스트를 생성해 줘. "
                        "모든 대체 텍스트는 한국어로 작성되어야 해. "
                        "각 대체 텍스트는 HTML의 img 태그에 alt 속성으로 추가된 형태로, 수정된 HTML 전체를 반환해 줘. "
                        "다른 추가적인 설명이나 텍스트는 포함하지 말고, 오직 수정된 HTML 코드만 반환해 줘."
                        f"\n\nHTML 콘텐츠:\n{html_content}"
                    )
                },
                *prompt_images
            ]
        }
    ]


# --- 기존 코드와 동일 ---
async def analyze_page_context_only(
        openai_client: OpenAI,
        html_content: str,
        screenshot_file: bytes
) -> str:
    try:
        page_analysis_messages = create_page_analysis_prompt(html_content)

        page_analysis_messages[-1]['content'] = [
            {"type": "text", "text": page_analysis_messages[-1]['content']},
            {"type": "image_url",
             "image_url": {"url": f"data:image/jpeg;base64,{base64.b64encode(screenshot_file).decode('utf-8')}"}}
        ]

        summary_response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=page_analysis_messages
        )
        return summary_response.choices[0].message.content
    except Exception as e:
        print(f"Error during page context analysis: {e}")
        raise


async def download_image(url: str) -> Optional[bytes]:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, follow_redirects=True, timeout=10.0)
            if response.status_code == 200:
                return response.content
            else:
                print(f"Warning: Failed to download image from {url} with status {response.status_code}")
                return None
        except httpx.HTTPError as exc:
            print(f"Error downloading image from {url}: {exc}")
            return None


async def analyze_and_generate_response(
        openai_client: OpenAI,
        image_urls: List[str],
        image_ids: List[str],
        screenshot_file: bytes,
        html_content: str,
        conversation_history: Optional[List[Message]] = None
) -> tuple[str, List[Dict], List[Message]]:
    try:
        page_analysis_messages = create_page_analysis_prompt(html_content, conversation_history)
        summary_response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=page_analysis_messages
        )
        page_description = summary_response.choices[0].message.content

        download_tasks = [download_image(url) for url in image_urls]
        image_bytes_list = [img for img in await asyncio.gather(*download_tasks) if img is not None]

        batch_prompt = create_alt_text_generation_prompt(
            base64.b64encode(screenshot_file).decode('utf-8'),
            html_content,
            image_bytes_list
        )
        batch_response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=batch_prompt
        )

        try:
            batch_results = json.loads(batch_response.choices[0].message.content)
            image_results_data = []
            for i, client_id in enumerate(image_ids):
                if i < len(batch_results):
                    result = batch_results[i]
                    image_results_data.append({
                        "client_id": client_id,
                        "filename": f"image_{i}.jpg",
                        "alt_text": result.get("alt_text", "")
                    })
        except json.JSONDecodeError:
            print("Warning: AI did not return a valid JSON response. Parsing failed.")
            image_results_data = []

        updated_history = conversation_history or []
        updated_history.append(Message(role="user", content="Analyze page and generate alt texts."))
        updated_history.append(Message(role="assistant", content=page_description))

        return page_description, image_results_data, updated_history

    except Exception as e:
        print(f"Error during AI analysis: {e}")
        raise