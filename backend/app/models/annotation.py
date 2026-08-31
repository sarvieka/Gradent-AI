"""SQLAlchemy model for PDF annotations."""

import uuid

from sqlalchemy import Boolean, Column, Float, Integer, String, Text

from app.database import Base


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), nullable=False, index=True)

    page = Column(Integer, nullable=False)
    bbox_x0 = Column(Float, nullable=False)
    bbox_y0 = Column(Float, nullable=False)
    bbox_x1 = Column(Float, nullable=False)
    bbox_y1 = Column(Float, nullable=False)

    annotation_type = Column(String(50), nullable=False)  # correct, incorrect, missing, partial, comment
    feedback_text = Column(Text, default="")
    is_user_edited = Column(Boolean, default=False)

    @property
    def bbox(self) -> list[float]:
        return [self.bbox_x0, self.bbox_y0, self.bbox_x1, self.bbox_y1]

    @bbox.setter
    def bbox(self, value: list[float]):
        self.bbox_x0, self.bbox_y0, self.bbox_x1, self.bbox_y1 = value
