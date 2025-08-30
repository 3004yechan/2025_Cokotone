from openai import OpenAI
from core.config import settings
from typing import Generator

# Supabase 클라이언트는 다른 팀원이 구현할 예정이므로 임시로 반환 값을 None으로 설정합니다.
def get_db_client() -> Generator[None, None, None]:
    """
    Supabase 클라이언트 인스턴스를 반환하는 의존성 주입 함수입니다.
    """
    # TODO: 다른 팀원이 Supabase 클라이언트 초기화 로직을 여기에 구현합니다.
    # 예시:
    # from supabase import create_client, Client
    # supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    # yield supabase
    yield None

# OpenAI 클라이언트 인스턴스를 반환합니다.
def get_openai_client() -> OpenAI:
    """
    OpenAI 클라이언트 인스턴스를 반환하는 의존성 주입 함수입니다.
    """
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return client