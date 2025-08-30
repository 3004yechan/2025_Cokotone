# dbkit/models.py
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, JSON, text

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    # SQLite에서도 자동 증가 되도록 Integer PK 사용
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )

class Interaction(Base):
    __tablename__ = "interactions"
    __table_args__ = {"sqlite_autoincrement": True}

    # ✅ BigInteger → Integer 로 변경 (SQLite autoincrement 호환)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    input_text: Mapped[str] = mapped_column(Text)
    output_text: Mapped[str] = mapped_column(Text, nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )

    user: Mapped["User"] = relationship(backref="interactions")

class Artifact(Base):
    __tablename__ = "artifacts"
    __table_args__ = {"sqlite_autoincrement": True}

    # ✅ BigInteger → Integer 로 변경 (SQLite autoincrement 호환)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    interaction_id: Mapped[int] = mapped_column(
        ForeignKey("interactions.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(32))   # 'image' | 'html' | 'code' | ...
    uri: Mapped[str] = mapped_column(Text)          # 파일 경로 또는 외부 URL
    extra: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
