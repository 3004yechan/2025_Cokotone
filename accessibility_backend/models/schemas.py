from pydantic import BaseModel, HttpUrl
from typing import Optional, List

class Message(BaseModel):
    role: str  # 'user' 또는 'assistant'
    content: str

class AskAIRequest(BaseModel):
    """
    클라이언트가 AI에 질문할 때 사용하는 요청 페이로드
    """
    user_id: str
    page_url: HttpUrl
    screenshot_base64: str
    html_content: str
    conversation_history: Optional[List[Message]] = None # 이전 대화 기록

class AIResponse(BaseModel):
    """
    백엔드가 클라이언트에게 반환하는 응답 페이로드
    """
    page_summary: str
    modified_html: str
    conversation_history: List[Message]