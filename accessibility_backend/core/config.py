import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SUPABASE_URL: str = os.getenv("https://ysscxscoebjerrdwnqqb.supabase.co")
    SUPABASE_KEY: str = os.getenv("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc2N4c2NvZWJqZXJyZHducXFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTAzMzcsImV4cCI6MjA3MjEyNjMzN30.ViLXGDE-uclWpVHVkcm29t2Wxa_p-VDlC1E5iU2pBuA")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")

settings = Settings()