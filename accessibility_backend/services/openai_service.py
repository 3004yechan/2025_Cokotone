import base64
import json
import asyncio
import httpx
from openai import OpenAI
from typing import Optional, List, Dict

from models.schemas import Message


# 페이지 맥락을 분석하기 위한 프롬프트를 생성합니다.
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
            "Analyze the following HTML content to understand the page's purpose and key functionalities. "
            "Provide a concise summary of what the user can do on this page."
            f"HTML Content:\n{html_content}"
        )
    })
    return messages


# 이미지에 대체 텍스트를 추가하기 위한 프롬프트를 생성합니다.
def create_alt_text_generation_prompt(
        screenshot_base64: str,
        html_content: str,
        image_files: List[bytes]
) -> List[Dict]:
    """
    대체 텍스트 생성을 위한 프롬프트를 구성합니다.
    HTML 문맥과 이미지(Base64)를 모두 포함합니다.
    """
    # 프롬프트에 들어갈 이미지 목록
    prompt_images = [
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{screenshot_base64}"}
        }
    ]

    # 다운로드된 개별 이미지 파일들을 프롬프트에 추가
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
                        "The following HTML contains images without 'alt' attributes. "
                        "Based on the provided screenshot and HTML, generate a suitable alt text for each image. "
                        "Return ONLY the modified HTML with the new alt texts added. Do not add any extra text or explanation."
                        f"\n\nHTML Content:\n{html_content}"
                    )
                },
                *prompt_images
            ]
        }
    ]


# --- 새로 추가된 단일 기능 함수 ---
async def analyze_page_context_only(
        openai_client: OpenAI,
        html_content: str,
        screenshot_file: bytes
) -> str:
    """
    이미지 없이 페이지 맥락만 분석합니다.
    """
    try:
        page_analysis_messages = create_page_analysis_prompt(html_content)

        # 스크린샷은 멀티모달 프롬프트에 추가
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


# 비동기 이미지 다운로드 함수
async def download_image(url: str) -> Optional[bytes]:
    """
    주어진 URL에서 이미지를 다운로드합니다. 실패 시 None을 반환합니다.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, follow_redirects=True, timeout=10.0)
            if response.status_code == 200:
                # TODO: 필요시 다운로드된 이미지의 크기나 해상도를 조절하는 로직 추가
                return response.content
            else:
                print(f"Warning: Failed to download image from {url} with status {response.status_code}")
                return None
        except httpx.HTTPError as exc:
            print(f"Error downloading image from {url}: {exc}")
            return None


# 모든 기능을 통합하여 실행하고 결과를 반환하는 메인 함수입니다.
async def analyze_and_generate_response(
        openai_client: OpenAI,
        image_urls: List[str],
        image_ids: List[str],
        screenshot_file: bytes,
        html_content: str,
        conversation_history: Optional[List[Message]] = None
) -> tuple[str, List[Dict], List[Message]]:
    """
    모든 분석 기능을 통합하여 실행하고 결과를 반환합니다.
    """
    try:
        # 1. 페이지 맥락 분석
        page_analysis_messages = create_page_analysis_prompt(html_content, conversation_history)
        summary_response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=page_analysis_messages
        )
        page_description = summary_response.choices[0].message.content

        # 2. 이미지 URL에서 바이트 데이터 다운로드
        download_tasks = [download_image(url) for url in image_urls]
        image_bytes_list = [img for img in await asyncio.gather(*download_tasks) if img is not None]

        # 3. 대체 텍스트 생성
        batch_prompt = create_alt_text_generation_prompt(
            base64.b64encode(screenshot_file).decode('utf-8'),
            html_content,
            image_bytes_list
        )
        batch_response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=batch_prompt
        )

        # AI가 반환한 수정된 HTML에서 alt 텍스트를 추출하여 매핑하는 로직
        try:
            # 예시: AI가 JSON 응답을 보낼 경우
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

        # 4. 대화 기록 업데이트
        updated_history = conversation_history or []
        updated_history.append(Message(role="user", content="Analyze page and generate alt texts."))
        updated_history.append(Message(role="assistant", content=page_description))

        return page_description, image_results_data, updated_history

    except Exception as e:
        print(f"Error during AI analysis: {e}")
        raise