import sys
import os
from fastapi import FastAPI, HTTPException, Depends
from models.schemas import AskAIRequest, AIResponse, Message
from services import openai_service, db_service
from core.dependencies import get_openai_client, get_db_client
from openai import OpenAI
from typing import Generator
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = FastAPI(
    title="AI Accessibility Guide Backend",
    description="AI를 활용하여 웹 접근성을 개선하는 백엔드 API"
)

@app.post("/analyze-page", response_model=AIResponse)
async def analyze_page(
    request: AskAIRequest,
    openai_client: OpenAI = Depends(get_openai_client),
    db_client: Generator = Depends(get_db_client) # db_client 타입은 추후 확정
):
    """
    웹 페이지 분석 요청을 처리하고 AI의 분석 결과를 반환합니다.

    - 클라이언트로부터 페이지 HTML, 스크린샷, 대화 기록을 받습니다.
    - AI 모델을 사용하여 페이지 맥락을 요약하고, 대체 텍스트를 생성합니다.
    - 대화 기록을 갱신하고, DB에 저장합니다.
    - 최종 결과를 클라이언트에게 반환합니다.
    """
    try:
        # DB에서 이전 대화 기록을 불러오거나, 클라이언트로부터 받은 기록을 활용합니다.
        # 이 예시에서는 클라이언트가 보낸 기록을 그대로 사용합니다.
        conversation_history = request.conversation_history

        # 1. AI에게 질문하여 답변받기
        page_summary, modified_html, new_history = await openai_service.analyze_and_generate_text(
            openai_client=openai_client,
            request=request.dict(),
            conversation_history=conversation_history
        )

        # 2. 질문 및 AI 답변 DB에 저장
        # db_client는 다른 팀원이 구현한 클라이언트가 될 것입니다.
        await db_service.save_analysis_log(
            db_client,
            request.user_id,
            request.page_url,
            request.dict(),
            {"summary": page_summary, "modified_html": modified_html}
        )

        # 3. 클라이언트에 결과 반환
        return AIResponse(
            page_summary=page_summary,
            modified_html=modified_html,
            conversation_history=new_history
        )

    except Exception as e:
        # AI 분석 실패 시 500 에러 반환
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: {e}"
        )