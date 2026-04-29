"""Upload module: routes data to Vercel Blob (production) or local cache (dev)."""

import json
import os


def upload_json(pathname: str, data: list | dict):
    """Upload JSON data to Vercel Blob storage."""
    import vercel_blob
    payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
    vercel_blob.put(pathname, payload, {'allowOverwrite': True, 'contentType': 'application/json'})
    print(f"Uploaded {len(payload)} bytes to blob: {pathname}")


def save_local(pathname: str, data, cache_dir: str = 'pipeline/cache'):
    """Save data as JSON to the local cache directory."""
    os.makedirs(cache_dir, exist_ok=True)
    dest = os.path.join(cache_dir, pathname)
    content = json.dumps(data, indent=2, ensure_ascii=False)
    with open(dest, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved {len(content.encode('utf-8'))} bytes to: {dest}")


def save(pathname: str, data):
    """Route save to Blob or local depending on USE_BLOB env var."""
    if os.getenv('USE_BLOB', '').lower() == 'true':
        upload_json(pathname, data)
    else:
        save_local(pathname, data)
