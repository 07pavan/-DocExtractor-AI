"""JWT Authentication dependency for verifying Supabase auth tokens (supports ES256 via JWKS and HS256).
"""

import os
import logging
from typing import Optional
from dotenv import load_dotenv
import jwt
from jwt import PyJWKClient

load_dotenv()
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger("api.auth")
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
    and HS256 (symmetric JWT secret) with automatic fallback.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header or Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "").strip()

    try:
        # Inspect token header to determine algorithm
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")

        payload = None

        if alg == "ES256":
            # 1. Primary: ES256 asymmetric JWKS verification
            try:
                jwks_client = get_jwks_client()
                if jwks_client:
                    signing_key = jwks_client.get_signing_key_from_jwt(token)
                    payload = jwt.decode(
                        token,
                        signing_key.key,
                        algorithms=["ES256"],
                        options={"verify_aud": False},
                    )
            except Exception as jwks_err:
                logger.warning("ES256 JWKS verification failed: %s. Trying HS256 fallback if configured...", jwks_err)
                # Fall back to HS256 secret or unverified decode in case of environment key mismatch
                if jwt_secret:
                    try:
                        payload = jwt.decode(
                            token,
                            jwt_secret,
                            algorithms=["HS256"],
                            options={"verify_aud": False},
                        )
                    except Exception:
                        pass
                if not payload:
                    raise jwks_err
        else:
            # 2. HS256 symmetric secret verification
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

        user_id: Optional[str] = payload.get("sub") if payload else None
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
    except (jwt.InvalidTokenError, jwt.PyJWTError, Exception) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
