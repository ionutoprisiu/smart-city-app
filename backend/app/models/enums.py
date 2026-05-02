import enum


class Role(str, enum.Enum):
    USER = "USER"
    ORGANIZER = "ORGANIZER"
    ADMIN = "ADMIN"


class VerificationStatus(str, enum.Enum):
    NOT_SUBMITTED = "NOT_SUBMITTED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class AttractionCategory(str, enum.Enum):
    MUSEUM = "MUSEUM"
    CHURCH = "CHURCH"
    SQUARE = "SQUARE"
    MONUMENT = "MONUMENT"
    FORTRESS = "FORTRESS"
    PARK = "PARK"
    RESTAURANT = "RESTAURANT"
    CAFE = "CAFE"
    SHOP = "SHOP"
    THEATER = "THEATER"
    LIBRARY = "LIBRARY"
    HOTEL = "HOTEL"
    OTHER = "OTHER"
