from openai import OpenAI
from models.schemas import Message
from typing import Optional, List


# 페이지 맥락을 분석하기 위한 프롬프트를 생성합니다.
def create_page_analysis_prompt(html_content: str, conversation_history: Optional[List[Message]] = None) -> List[dict]:
    messages = []
    if conversation_history:
        messages.extend([{"role": msg.role, "content": msg.content} for msg in conversation_history])

    messages.append({
        "role": "user",
        "content": (
                "Analyze the following HTML content to understand the page's purpose and key functionalities. "
                "Provide a concise summary of what the user can do on this page. "
                "HTML Content:\n" + html_content
        )
    })
    return messages


# 이미지에 대체 텍스트를 추가하기 위한 프롬프트를 생성합니다.
def create_alt_text_generation_prompt(screenshot_base64: str, html_content: str) -> List[dict]:
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


async def analyze_and_generate_text(
        openai_client: OpenAI,
        request: dict,  # AskAIRequest의 딕셔너리 형태
        conversation_history: Optional[List[Message]] = None
) -> tuple[str, str, List[Message]]:
    """
    OpenAI API를 사용하여 페이지를 분석하고 대체 텍스트를 생성합니다.
    """
    # 1. 페이지 맥락 분석
    page_analysis_messages = create_page_analysis_prompt(request['html_content'], conversation_history)
    summary_response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=page_analysis_messages
    )
    page_summary = summary_response.choices[0].message.content

    # 2. 대체 텍스트 생성
    alt_text_messages = create_alt_text_generation_prompt(
        request['screenshot_base64'],
        request['html_content']
    )
    modified_html_response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=alt_text_messages
    )
    modified_html = modified_html_response.choices[0].message.content

    # 3. 대화 기록 업데이트
    updated_history = conversation_history or []
    updated_history.append(Message(role="user", content="Analyze page and generate alt texts."))
    updated_history.append(Message(role="assistant", content=page_summary))

    return page_summary, modified_html, updated_history