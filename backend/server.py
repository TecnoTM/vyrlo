from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import stripe

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'vyrlo_db')]

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', '')

# Test mode connected accounts for demo sellers
# In production, these would be real Stripe Connect account IDs
TEST_CONNECTED_ACCOUNTS = {
    "demo_owner": "acct_test_demo_owner",
    "demo_owner2": "acct_test_demo_owner2", 
    "demo_owner3": "acct_test_demo_owner3",
}

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None

class Item(BaseModel):
    item_id: str = Field(default_factory=lambda: f"item_{uuid.uuid4().hex[:12]}")
    title: str
    category: str
    condition: str = "Ottime condizioni"
    price: float
    description: str
    image: str
    owner_id: str
    owner_name: Optional[str] = None
    owner_picture: Optional[str] = None
    custom_deposit: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ItemCreate(BaseModel):
    title: str
    category: str
    condition: str = "Ottime condizioni"
    price: float
    description: str
    image: str
    custom_deposit: Optional[float] = None

class ItemResponse(BaseModel):
    item_id: str
    title: str
    category: str
    condition: str
    price: float
    description: str
    image: str
    owner_id: str
    owner_name: Optional[str] = None
    owner_picture: Optional[str] = None
    custom_deposit: Optional[float] = None
    created_at: datetime

class Booking(BaseModel):
    booking_id: str = Field(default_factory=lambda: f"booking_{uuid.uuid4().hex[:12]}")
    item_id: str
    renter_id: str
    owner_id: str
    days: int
    subtotal: float
    protection_fee: float
    deposit: float
    total: float
    status: str = "confirmed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BookingCreate(BaseModel):
    item_id: str
    days: int

class BookingResponse(BaseModel):
    booking_id: str
    item_id: str
    renter_id: str
    owner_id: str
    days: int
    subtotal: float
    protection_fee: float
    deposit: float
    total: float
    status: str
    created_at: datetime
    stripe_session_id: Optional[str] = None
    payment_status: Optional[str] = None

# Payment Transaction Models
class PaymentTransaction(BaseModel):
    transaction_id: str = Field(default_factory=lambda: f"txn_{uuid.uuid4().hex[:12]}")
    booking_id: str
    item_id: str
    user_id: str
    seller_id: str
    stripe_session_id: str
    amount: float  # Total amount in EUR
    subtotal: float  # Amount to seller
    platform_fee: float  # 15% commission (Vyrlo Protection)
    deposit: float  # Refundable deposit
    currency: str = "eur"
    payment_status: str = "pending"  # pending, paid, failed, expired
    stripe_payment_intent_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class CheckoutRequest(BaseModel):
    item_id: str
    days: int
    origin_url: str

class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str
    booking_id: str

# Chat Models
class Message(BaseModel):
    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    conversation_id: str
    sender_id: str
    receiver_id: str
    content: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    receiver_id: str
    content: str
    item_id: Optional[str] = None  # Optional: reference to an item

class MessageResponse(BaseModel):
    message_id: str
    conversation_id: str
    sender_id: str
    receiver_id: str
    content: str
    read: bool
    created_at: datetime
    sender_name: Optional[str] = None
    sender_picture: Optional[str] = None

class Conversation(BaseModel):
    conversation_id: str
    participants: List[str]
    item_id: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConversationResponse(BaseModel):
    conversation_id: str
    participants: List[str]
    item_id: Optional[str] = None
    item_title: Optional[str] = None
    item_image: Optional[str] = None
    other_user_id: str
    other_user_name: str
    other_user_picture: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0

# ==================== AUTH HELPERS ====================

async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token (cookie or header)"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        return None
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        return None
    
    return User(**user_doc)

async def require_auth(request: Request) -> User:
    """Require authentication - raises 401 if not authenticated"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            data = auth_response.json()
        except Exception as e:
            logger.error(f"Auth error: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed")
    
    email = data.get("email")
    name = data.get("name")
    picture = data.get("picture")
    session_token = data.get("session_token")
    
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "description": None,
            "phone": None,
            "location": None,
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user_doc)
    
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await require_auth(request)
    return UserResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        description=user.description,
        phone=user.phone,
        location=user.location
    )

@api_router.put("/auth/me", response_model=UserResponse)
async def update_me(update_data: UserUpdate, request: Request):
    """Update current user's profile"""
    user = await require_auth(request)
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    if update_dict:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": update_dict}
        )
    
    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return UserResponse(**updated_user)

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== USER PROFILE ENDPOINTS ====================

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_profile(user_id: str):
    """Get public user profile"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return public profile info only
    return UserResponse(
        user_id=user["user_id"],
        email=user.get("email", ""),
        name=user.get("name", ""),
        picture=user.get("picture"),
        description=user.get("description"),
        phone=user.get("phone"),
        location=user.get("location")
    )

# ==================== ITEMS ENDPOINTS ====================

@api_router.get("/items", response_model=List[ItemResponse])
async def get_items(category: Optional[str] = None, search: Optional[str] = None):
    """Get all items with optional filtering"""
    query = {}
    
    if category:
        query["category"] = category
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    items = await db.items.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [ItemResponse(**item) for item in items]

@api_router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str):
    """Get single item by ID"""
    item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return ItemResponse(**item)

@api_router.post("/items", response_model=ItemResponse)
async def create_item(item_data: ItemCreate, request: Request):
    """Create new item (requires auth)"""
    user = await require_auth(request)
    
    item = Item(
        title=item_data.title,
        category=item_data.category,
        condition=item_data.condition,
        price=item_data.price,
        description=item_data.description,
        image=item_data.image,
        owner_id=user.user_id,
        owner_name=user.name,
        owner_picture=user.picture,
        custom_deposit=item_data.custom_deposit
    )
    
    await db.items.insert_one(item.model_dump())
    return ItemResponse(**item.model_dump())

@api_router.get("/my-items", response_model=List[ItemResponse])
async def get_my_items(request: Request):
    """Get items owned by current user"""
    user = await require_auth(request)
    items = await db.items.find({"owner_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [ItemResponse(**item) for item in items]

# ==================== BOOKINGS ENDPOINTS ====================

@api_router.post("/bookings", response_model=BookingResponse)
async def create_booking(booking_data: BookingCreate, request: Request):
    """Create a new booking (requires auth)"""
    user = await require_auth(request)
    
    item = await db.items.find_one({"item_id": booking_data.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item["owner_id"] == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot book your own item")
    
    subtotal = item["price"] * booking_data.days
    protection_fee = round(subtotal * 0.15, 2)
    
    if item.get("custom_deposit") is not None:
        deposit = item["custom_deposit"]
    else:
        deposit = round(subtotal * 0.20, 2)
    
    total = round(subtotal + protection_fee + deposit, 2)
    
    booking = Booking(
        item_id=booking_data.item_id,
        renter_id=user.user_id,
        owner_id=item["owner_id"],
        days=booking_data.days,
        subtotal=subtotal,
        protection_fee=protection_fee,
        deposit=deposit,
        total=total
    )
    
    await db.bookings.insert_one(booking.model_dump())
    return BookingResponse(**booking.model_dump())

@api_router.get("/my-bookings", response_model=List[BookingResponse])
async def get_my_bookings(request: Request):
    """Get bookings made by current user"""
    user = await require_auth(request)
    bookings = await db.bookings.find({"renter_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [BookingResponse(**b) for b in bookings]

@api_router.get("/my-rentals", response_model=List[BookingResponse])
async def get_my_rentals(request: Request):
    """Get bookings for items owned by current user"""
    user = await require_auth(request)
    bookings = await db.bookings.find({"owner_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [BookingResponse(**b) for b in bookings]

# ==================== STRIPE PAYMENT ENDPOINTS ====================

@api_router.post("/checkout/create", response_model=CheckoutResponse)
async def create_checkout_session(checkout_data: CheckoutRequest, request: Request):
    """Create a Stripe Checkout session with Connect destination charges"""
    user = await require_auth(request)
    
    # Get item details
    item = await db.items.find_one({"item_id": checkout_data.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item["owner_id"] == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot rent your own item")
    
    # Calculate prices
    subtotal = float(item["price"]) * checkout_data.days
    protection_fee = round(subtotal * 0.15, 2)  # 15% platform commission
    
    if item.get("custom_deposit") is not None:
        deposit = float(item["custom_deposit"])
    else:
        deposit = round(subtotal * 0.20, 2)  # 20% default deposit
    
    total = round(subtotal + protection_fee + deposit, 2)
    
    # Create booking first
    booking = Booking(
        item_id=checkout_data.item_id,
        renter_id=user.user_id,
        owner_id=item["owner_id"],
        days=checkout_data.days,
        subtotal=subtotal,
        protection_fee=protection_fee,
        deposit=deposit,
        total=total,
        status="pending"
    )
    
    await db.bookings.insert_one(booking.model_dump())
    
    # Build success/cancel URLs
    success_url = f"{checkout_data.origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&booking_id={booking.booking_id}"
    cancel_url = f"{checkout_data.origin_url}/item/{checkout_data.item_id}"
    
    try:
        # Get connected account for seller (test mode simulation)
        # In production, sellers would have real Stripe Connect accounts
        seller_connected_account = TEST_CONNECTED_ACCOUNTS.get(item["owner_id"])
        
        # Convert total to cents for Stripe
        amount_cents = int(total * 100)
        # Platform fee (15% commission) in cents
        platform_fee_cents = int(protection_fee * 100)
        
        # Create Stripe Checkout Session
        # For test mode without real connected accounts, we use standard checkout
        # In production with real accounts, use transfer_data and application_fee_amount
        
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'unit_amount': amount_cents,
                    'product_data': {
                        'name': f"Noleggio: {item['title']}",
                        'description': f"{checkout_data.days} giorni - Include Protezione Vyrlo e deposito cauzionale",
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                'booking_id': booking.booking_id,
                'item_id': checkout_data.item_id,
                'user_id': user.user_id,
                'seller_id': item["owner_id"],
                'days': str(checkout_data.days),
                'subtotal': str(subtotal),
                'platform_fee': str(protection_fee),
                'deposit': str(deposit),
            },
            # Note: For production with real Connect accounts, add:
            # payment_intent_data={
            #     'application_fee_amount': platform_fee_cents,
            #     'transfer_data': {
            #         'destination': seller_connected_account,
            #     },
            # },
        )
        
        # Create payment transaction record
        transaction = PaymentTransaction(
            booking_id=booking.booking_id,
            item_id=checkout_data.item_id,
            user_id=user.user_id,
            seller_id=item["owner_id"],
            stripe_session_id=checkout_session.id,
            amount=total,
            subtotal=subtotal,
            platform_fee=protection_fee,
            deposit=deposit,
            payment_status="pending"
        )
        
        await db.payment_transactions.insert_one(transaction.model_dump())
        
        # Update booking with session ID
        await db.bookings.update_one(
            {"booking_id": booking.booking_id},
            {"$set": {"stripe_session_id": checkout_session.id}}
        )
        
        return CheckoutResponse(
            checkout_url=checkout_session.url,
            session_id=checkout_session.id,
            booking_id=booking.booking_id
        )
        
    except stripe.error.StripeError as e:
        # If Stripe fails, delete the pending booking
        await db.bookings.delete_one({"booking_id": booking.booking_id})
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=f"Payment error: {str(e)}")

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    """Get the status of a Stripe checkout session and update booking"""
    user = await require_auth(request)
    
    # Find the transaction
    transaction = await db.payment_transactions.find_one(
        {"stripe_session_id": session_id},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Verify user owns this transaction
    if transaction["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        # Get session status from Stripe
        checkout_session = stripe.checkout.Session.retrieve(session_id)
        
        payment_status = checkout_session.payment_status  # paid, unpaid, no_payment_required
        session_status = checkout_session.status  # complete, expired, open
        
        # Map to our status
        if payment_status == "paid":
            new_status = "paid"
            booking_status = "confirmed"
        elif session_status == "expired":
            new_status = "expired"
            booking_status = "cancelled"
        else:
            new_status = "pending"
            booking_status = "pending"
        
        # Update only if status changed and not already processed
        if transaction["payment_status"] != new_status:
            await db.payment_transactions.update_one(
                {"stripe_session_id": session_id},
                {"$set": {
                    "payment_status": new_status,
                    "stripe_payment_intent_id": checkout_session.payment_intent,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            
            await db.bookings.update_one(
                {"booking_id": transaction["booking_id"]},
                {"$set": {
                    "status": booking_status,
                    "payment_status": new_status
                }}
            )
        
        # Get booking details for response
        booking = await db.bookings.find_one(
            {"booking_id": transaction["booking_id"]},
            {"_id": 0}
        )
        
        # Get item details
        item = await db.items.find_one(
            {"item_id": transaction["item_id"]},
            {"_id": 0}
        )
        
        return {
            "payment_status": new_status,
            "session_status": session_status,
            "booking_id": transaction["booking_id"],
            "booking": booking,
            "item": item,
            "amount_total": transaction["amount"],
            "subtotal": transaction["subtotal"],
            "platform_fee": transaction["platform_fee"],
            "deposit": transaction["deposit"],
            "currency": "eur"
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error checking status: {e}")
        raise HTTPException(status_code=400, detail=f"Error checking payment: {str(e)}")

@api_router.get("/booking/{booking_id}")
async def get_booking_details(booking_id: str, request: Request):
    """Get detailed booking information"""
    user = await require_auth(request)
    
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is renter or owner
    if booking["renter_id"] != user.user_id and booking["owner_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get item details
    item = await db.items.find_one({"item_id": booking["item_id"]}, {"_id": 0})
    
    # Get owner details
    owner = await db.users.find_one({"user_id": booking["owner_id"]}, {"_id": 0})
    
    return {
        "booking": BookingResponse(**booking),
        "item": ItemResponse(**item) if item else None,
        "owner": UserResponse(**owner) if owner else None
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature")
    
    # For production, verify webhook signature
    # endpoint_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    
    try:
        event = stripe.Event.construct_from(
            stripe.util.convert_to_dict(await request.json()),
            stripe.api_key
        )
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook")
    
    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        # Update transaction and booking
        await db.payment_transactions.update_one(
            {"stripe_session_id": session['id']},
            {"$set": {
                "payment_status": "paid",
                "stripe_payment_intent_id": session.get('payment_intent'),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Get transaction to find booking
        transaction = await db.payment_transactions.find_one(
            {"stripe_session_id": session['id']},
            {"_id": 0}
        )
        
        if transaction:
            await db.bookings.update_one(
                {"booking_id": transaction["booking_id"]},
                {"$set": {"status": "confirmed", "payment_status": "paid"}}
            )
            
        logger.info(f"Payment completed for session {session['id']}")
    
    elif event['type'] == 'checkout.session.expired':
        session = event['data']['object']
        
        await db.payment_transactions.update_one(
            {"stripe_session_id": session['id']},
            {"$set": {
                "payment_status": "expired",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        transaction = await db.payment_transactions.find_one(
            {"stripe_session_id": session['id']},
            {"_id": 0}
        )
        
        if transaction:
            await db.bookings.update_one(
                {"booking_id": transaction["booking_id"]},
                {"$set": {"status": "cancelled", "payment_status": "expired"}}
            )
    
    return {"received": True}

@api_router.get("/stripe/config")
async def get_stripe_config():
    """Get Stripe publishable key for frontend"""
    if not STRIPE_PUBLISHABLE_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    return {"publishable_key": STRIPE_PUBLISHABLE_KEY}

# ==================== CHAT ENDPOINTS ====================

def get_conversation_id(user1_id: str, user2_id: str, item_id: Optional[str] = None) -> str:
    """Generate a consistent conversation ID for two users"""
    sorted_ids = sorted([user1_id, user2_id])
    base_id = f"conv_{sorted_ids[0]}_{sorted_ids[1]}"
    if item_id:
        base_id += f"_{item_id}"
    return base_id

@api_router.post("/messages", response_model=MessageResponse)
async def send_message(message_data: MessageCreate, request: Request):
    """Send a message to another user"""
    user = await require_auth(request)
    
    if message_data.receiver_id == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    
    # Check receiver exists
    receiver = await db.users.find_one({"user_id": message_data.receiver_id}, {"_id": 0})
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    
    conversation_id = get_conversation_id(user.user_id, message_data.receiver_id, message_data.item_id)
    
    # Create or update conversation
    existing_conv = await db.conversations.find_one({"conversation_id": conversation_id})
    
    if not existing_conv:
        conv = Conversation(
            conversation_id=conversation_id,
            participants=[user.user_id, message_data.receiver_id],
            item_id=message_data.item_id,
            last_message=message_data.content[:100],
            last_message_at=datetime.now(timezone.utc)
        )
        await db.conversations.insert_one(conv.model_dump())
    else:
        await db.conversations.update_one(
            {"conversation_id": conversation_id},
            {"$set": {
                "last_message": message_data.content[:100],
                "last_message_at": datetime.now(timezone.utc)
            }}
        )
    
    # Create message
    message = Message(
        conversation_id=conversation_id,
        sender_id=user.user_id,
        receiver_id=message_data.receiver_id,
        content=message_data.content
    )
    
    await db.messages.insert_one(message.model_dump())
    
    return MessageResponse(
        **message.model_dump(),
        sender_name=user.name,
        sender_picture=user.picture
    )

@api_router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(request: Request):
    """Get all conversations for current user"""
    user = await require_auth(request)
    
    conversations = await db.conversations.find(
        {"participants": user.user_id},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(100)
    
    result = []
    for conv in conversations:
        other_user_id = [p for p in conv["participants"] if p != user.user_id][0]
        other_user = await db.users.find_one({"user_id": other_user_id}, {"_id": 0})
        
        # Count unread messages
        unread_count = await db.messages.count_documents({
            "conversation_id": conv["conversation_id"],
            "receiver_id": user.user_id,
            "read": False
        })
        
        # Get item info if available
        item_title = None
        item_image = None
        if conv.get("item_id"):
            item = await db.items.find_one({"item_id": conv["item_id"]}, {"_id": 0})
            if item:
                item_title = item.get("title")
                item_image = item.get("image")
        
        result.append(ConversationResponse(
            conversation_id=conv["conversation_id"],
            participants=conv["participants"],
            item_id=conv.get("item_id"),
            item_title=item_title,
            item_image=item_image,
            other_user_id=other_user_id,
            other_user_name=other_user.get("name", "Unknown") if other_user else "Unknown",
            other_user_picture=other_user.get("picture") if other_user else None,
            last_message=conv.get("last_message"),
            last_message_at=conv.get("last_message_at"),
            unread_count=unread_count
        ))
    
    return result

@api_router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(conversation_id: str, request: Request):
    """Get messages in a conversation"""
    user = await require_auth(request)
    
    # Verify user is participant
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or user.user_id not in conv["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    # Mark messages as read
    await db.messages.update_many(
        {
            "conversation_id": conversation_id,
            "receiver_id": user.user_id,
            "read": False
        },
        {"$set": {"read": True}}
    )
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    result = []
    for msg in messages:
        sender = await db.users.find_one({"user_id": msg["sender_id"]}, {"_id": 0})
        result.append(MessageResponse(
            **msg,
            sender_name=sender.get("name") if sender else None,
            sender_picture=sender.get("picture") if sender else None
        ))
    
    return result

@api_router.post("/conversations/start")
async def start_conversation(request: Request):
    """Start a new conversation with a user (optionally about an item)"""
    user = await require_auth(request)
    body = await request.json()
    
    receiver_id = body.get("receiver_id")
    item_id = body.get("item_id")
    message = body.get("message", "")
    
    if not receiver_id:
        raise HTTPException(status_code=400, detail="receiver_id required")
    
    if receiver_id == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    
    conversation_id = get_conversation_id(user.user_id, receiver_id, item_id)
    
    # Check if conversation exists
    existing = await db.conversations.find_one({"conversation_id": conversation_id})
    
    if not existing:
        conv = Conversation(
            conversation_id=conversation_id,
            participants=[user.user_id, receiver_id],
            item_id=item_id
        )
        await db.conversations.insert_one(conv.model_dump())
    
    # Send initial message if provided
    if message:
        msg = Message(
            conversation_id=conversation_id,
            sender_id=user.user_id,
            receiver_id=receiver_id,
            content=message
        )
        await db.messages.insert_one(msg.model_dump())
        
        await db.conversations.update_one(
            {"conversation_id": conversation_id},
            {"$set": {
                "last_message": message[:100],
                "last_message_at": datetime.now(timezone.utc)
            }}
        )
    
    return {"conversation_id": conversation_id}

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    """Seed initial test data"""
    existing = await db.items.count_documents({})
    if existing > 0:
        return {"message": "Data already seeded", "count": existing}
    
    test_items = [
        {
            "item_id": "item_drone001",
            "title": "Drone DJI Mini 4 Pro",
            "category": "Foto & Video",
            "condition": "Come nuovo",
            "price": 45.0,
            "description": "Drone professionale sotto i 250g, riprese 4K HDR. Batteria extra inclusa. Perfetto per riprese aeree cinematografiche.",
            "image": "https://images.unsplash.com/photo-1697994309718-2037ef5e1931?w=600&q=80",
            "owner_id": "demo_owner",
            "owner_name": "Marco R.",
            "owner_picture": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80",
            "custom_deposit": None,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "item_id": "item_manga001",
            "title": "Collezione Manga Rari - Berserk Deluxe",
            "category": "Libri & Fumetti",
            "condition": "Ottime condizioni",
            "price": 8.0,
            "description": "Edizione deluxe completa di Berserk, volumi 1-12. Copertina rigida, stampa premium. Ideale per collezionisti.",
            "image": "https://images.unsplash.com/photo-1709675577966-6231e5a2ac43?w=600&q=80",
            "owner_id": "demo_owner2",
            "owner_name": "Giulia T.",
            "owner_picture": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80",
            "custom_deposit": 50.0,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "item_id": "item_libro001",
            "title": "Atlante di Anatomia Umana - Netter",
            "category": "Libri & Fumetti",
            "condition": "Buone condizioni",
            "price": 5.0,
            "description": "7a edizione dell'Atlante Netter. Libro fondamentale per studenti di medicina. Alcune sottolineature a matita.",
            "image": "https://images.unsplash.com/photo-1652787544912-137c7f92f99b?w=600&q=80",
            "owner_id": "demo_owner3",
            "owner_name": "Andrea M.",
            "owner_picture": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80",
            "custom_deposit": None,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "item_id": "item_camera001",
            "title": "Sony Alpha A7 IV + 24-70mm f/2.8",
            "category": "Foto & Video",
            "condition": "Come nuovo",
            "price": 75.0,
            "description": "Kit professionale full-frame. 33MP, video 4K 60fps. Include 3 batterie, scheda SD 128GB e borsa imbottita.",
            "image": "https://images.unsplash.com/photo-1606986628470-26a67fa4730c?w=600&q=80",
            "owner_id": "demo_owner",
            "owner_name": "Marco R.",
            "owner_picture": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80",
            "custom_deposit": 200.0,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    # Create demo users
    demo_users = [
        {
            "user_id": "demo_owner",
            "email": "marco@demo.com",
            "name": "Marco R.",
            "picture": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80",
            "description": "Appassionato di fotografia e tecnologia. Noleggio la mia attrezzatura quando non la uso!",
            "location": "Milano, IT",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": "demo_owner2",
            "email": "giulia@demo.com",
            "name": "Giulia T.",
            "picture": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80",
            "description": "Collezionista di manga e fumetti. Condivido la mia passione!",
            "location": "Roma, IT",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": "demo_owner3",
            "email": "andrea@demo.com",
            "name": "Andrea M.",
            "picture": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80",
            "description": "Studente di medicina. Noleggio i miei libri universitari.",
            "location": "Bologna, IT",
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    for user in demo_users:
        existing_user = await db.users.find_one({"user_id": user["user_id"]})
        if not existing_user:
            await db.users.insert_one(user)
    
    await db.items.insert_many(test_items)
    return {"message": "Seeded successfully", "count": len(test_items)}

@api_router.get("/")
async def root():
    return {"message": "Vyrlo API v1.0"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
