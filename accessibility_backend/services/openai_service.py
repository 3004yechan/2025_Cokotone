import base64
import json
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
def create_alt_text_generation_prompt(screenshot_base64: str, html_content: str) -> List[Dict]:
    """
    대체 텍스트 생성을 위한 프롬프트를 구성합니다.
    HTML 문맥과 이미지(Base64)를 모두 포함합니다.
    """
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
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{screenshot_base64}"
                    }
                }
            ]
        }
    ]


# 모든 기능을 통합하여 실행하고 결과를 반환하는 메인 함수입니다.
async def analyze_and_generate_response(
        openai_client: OpenAI,
        image_files: List[bytes],
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

        # 2. 대체 텍스트 생성
        batch_prompt = create_alt_text_generation_prompt(
            base64.b64encode(screenshot_file).decode('utf-8'),
            html_content
        )
        batch_response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=batch_prompt
        )

        # AI가 반환한 수정된 HTML에서 alt 텍스트와 ID를 추출하여 매핑 (새로운 로직 필요)
        # 이 예시에서는 응답을 JSON으로 받는 것으로 가정합니다.
        try:
            # AI가 JSON 응답을 보낼 경우
            batch_results = json.loads(batch_response.choices[0].message.content)
            image_results_data = []
            for i, client_id in enumerate(image_ids):
                if i < len(batch_results):
                    result = batch_results[i]
                    image_results_data.append({
                        "client_id": client_id,
                        "filename": f"image_{i}.jpg",  # 임시 파일명
                        "alt_text": result.get("alt_text", "")
                    })
        except json.JSONDecodeError:
            # AI가 JSON 대신 HTML을 반환할 경우, HTML을 파싱하여 alt 텍스트를 추출하는 복잡한 로직이 필요
            # 여기서는 편의를 위해 임시로 빈 리스트를 반환합니다.
            print("Warning: AI did not return a valid JSON response. Parsing failed.")
            image_results_data = []

        # 3. 대화 기록 업데이트
        updated_history = conversation_history or []
        updated_history.append(Message(role="user", content="Analyze page and generate alt texts."))
        updated_history.append(Message(role="assistant", content=page_description))

        return page_description, image_results_data, updated_history

    except Exception as e:
        print(f"Error during AI analysis: {e}")
        raise