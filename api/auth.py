"""JWT Authentication dependency for verifying Supabase auth tokens (supports ES256 via JWKS and HS256).
"""

import os
from typing import Optional
from dotenv import load_dotenv
import jwt
from jwt import PyJWKClient

load_dotenv()
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

# Cached JWKS client
_jwks_client: Optional[PyJWKClient] = None


def get_jwks_client() -> Optional[PyJWKClient]:
    """Returns a cached PyJWKClient configured with the Supabase JWKS endpoint."""
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client

    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    if supabase_url.endswith("/rest/v1"):
        supabase_url = supabase_url[:-len("/rest/v1")].rstrip("/")

    if not supabase_url:
        return None

    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """FastAPI dependency that extracts and validates the Supabase JWT from the

    'Authorization: Bearer <token>' header. Supports both ES256 (asymmetric JWKS)
    and HS256 (symmetric JWT secret).
    
    Returns:
        The authenticated user's ID (the 'sub' claim).
        
    Raises:
        HTTPException 401 if the token is missing, expired, or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header or Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")

    try:
        # Inspect token header to determine the signing algorithm
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")

        if alg == "ES256":
            # Modern Supabase ECC key validation via JWKS
            jwks_client = get_jwks_client()
            if not jwks_client:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Server authentication configuration error (SUPABASE_URL not configured).",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                options={"verify_aud": False},
            )
        else:
            # Symmetric HS256 secret validation
            if not jwt_secret:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Server authentication configuration error (SUPABASE_JWT_SECRET not configured).",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )

        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject (sub) claim.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user_id

    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except (jwt.InvalidTokenError, jwt.PyJWTError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
