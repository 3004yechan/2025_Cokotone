from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, List, Dict, Any

class Message(BaseModel):
    """
    OpenAI와의 대화 메시지 형식을 정의합니다.
    """
    role: str  # 'user' 또는 'assistant'
    content: str

class ImageAnalysisResult(BaseModel):
    """
    개별 이미지 분석 결과를 담는 모델
    """
    client_id: str = Field(..., description="클라이언트가 부여한 이미지의 고유 ID")
    filename: str = Field(..., description="이미지 파일명")
    alt_text: str = Field(..., description="AI가 생성한 대체 텍스트")

class BatchAnalysisResponse(BaseModel):
    """
    다중 이미지 종합 분석 요청에 대한 응답 모델.
    페이지 맥락과 대화 기록을 포함합니다.
    """
    page_description: str = Field(..., description="AI가 분석한 페이지의 전체 맥락 요약")
    image_results: List[ImageAnalysisResult] = Field(..., description="개별 이미지 분석 결과 리스트")
    conversation_history: List[Message] = Field(..., description="갱신된 대화 기록")
    created_at: str = Field(..., description="API 요청 처리 시간 (ISO 8601 형식)")

# 이전의 AskAIRequest는 이 명세에서 사용되지 않으므로 삭제하거나 유지할 수 있습니다.