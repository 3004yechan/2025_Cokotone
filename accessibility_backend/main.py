import sys
import os
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Generator
from pydantic import BaseModel

# 프로젝트 루트 디렉터리를 시스템 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.schemas import BatchAnalysisResponse, ImageAnalysisResult, Message
from services import openai_service, db_service
from core.dependencies import get_openai_client, get_db_client
from openai import OpenAI

# ----------------- 애플리케이션 초기화 -----------------
app = FastAPI(
    title="AI Accessibility Guide Backend",
    description="AI를 활용하여 웹 접근성을 개선하는 백엔드 API",
    version="0.1.0"
)

# CORS 미들웨어 추가 (클라이언트의 요청을 허용하기 위함)
origins = [
    "chrome-extension://<YOUR_EXTENSION_ID>",
    "http://127.0.0.1:8000"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------- 응답 모델 정의 -----------------
class PageContextResponse(BaseModel):
    """
    이미지가 없는 페이지 분석에 대한 응답 모델
    """
    page_description: str
    created_at: str


# ----------------- API 엔드포인트 정의 -----------------
@app.post("/analyses/batch_comprehensive", response_model=BatchAnalysisResponse)
async def batch_comprehensive_analysis(
        # image_files: List[UploadFile] = File(..., description="분석할 개별 이미지 파일 목록"), # 제거
        image_ids: str = Form(..., description="각 이미지에 대응되는 고유 ID 목록 (쉼표로 구분된 문자열)"),
        # 새롭게 추가된 image_urls 매개변수
        image_urls: str = Form(..., description="이미지 URL 목록 (쉼표로 구분된 문자열)"),
        screenshot_file: UploadFile = File(..., description="페이지 전체 스크롤 캡처 스크린샷"),
        html_content: Optional[str] = Form(None, description="페이지의 전체 HTML 소스 코드"),
        conversation_history: Optional[str] = Form(None, description="이전 대화 기록 (JSON 문자열)"),
        openai_client: OpenAI = Depends(get_openai_client),
        db_client: Generator = Depends(get_db_client)  # db_client 타입은 추후 확정
):
    """
    다중 이미지에 대한 종합 분석 및 대체 텍스트를 생성합니다.
    """
    try:
        # 요청 데이터 전처리
        client_ids_list = [id.strip() for id in image_ids.split(',')]
        # image_bytes_list = [await file.read() for file in image_files]
        image_urls_list = [url.strip() for url in image_urls.split(',') if url.strip()]
        screenshot_bytes = await screenshot_file.read()

        conversation_history_list = []
        if conversation_history:
            conversation_history_list = [Message(**msg) for msg in json.loads(conversation_history)]

        # AI 분석 서비스의 통합 함수 호출
        page_description, image_results_data, updated_history = await openai_service.analyze_and_generate_response(
            openai_client=openai_client,
            # image_files=image_bytes_list, # 제거
            image_urls=image_urls_list, # 추가
            image_ids=client_ids_list,
            screenshot_file=screenshot_bytes,
            html_content=html_content,
            conversation_history=conversation_history_list
        )

        # DB에 결과 저장 (필요시)
        # TODO: db_client를 사용하여 데이터베이스에 분석 로그를 저장하는 로직을 추가하세요.
        # await db_service.save_analysis_log(...)

        # 응답 모델 생성 및 반환
        image_results = [ImageAnalysisResult(**res) for res in image_results_data]

        return BatchAnalysisResponse(
            page_description=page_description,
            image_results=image_results,
            conversation_history=updated_history,
            created_at=datetime.utcnow().isoformat() + 'Z'
        )

    except Exception as e:
        print(f"DEBUG: An error occurred: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during batch analysis: {e}"
        )


# ----------------- 새로운 엔드포인트 추가 -----------------
@app.post("/analyses/page_context", response_model=PageContextResponse)
async def analyze_page_context(
        screenshot_file: UploadFile = File(..., description="페이지 전체 스크린샷"),
        html_content: Optional[str] = Form(None, description="페이지의 전체 HTML 소스 코드"),
        openai_client: OpenAI = Depends(get_openai_client),
):
    """
    이미지가 없는 페이지에 대한 맥락 분석을 수행합니다.
    """
    try:
        screenshot_bytes = await screenshot_file.read()

        # ai_service에 추가해야 할 페이지 맥락 분석 전용 함수 호출
        page_description = await openai_service.analyze_page_context_only(
            openai_client=openai_client,
            html_content=html_content,
            screenshot_file=screenshot_bytes
        )

        return PageContextResponse(
            page_description=page_description,
            created_at=datetime.utcnow().isoformat() + 'Z'
        )

    except Exception as e:
        print(f"DEBUG: An error occurred: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during page context analysis: {e}"
        )