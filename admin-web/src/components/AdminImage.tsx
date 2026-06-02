import { useEffect, useState } from "react";
import { getStoredToken } from "../api/client";

type AdminImageProps = {
  src: string;
  alt: string;
};

export function AdminImage({ src, alt }: AdminImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    setFailed(false);
    setObjectUrl(null);

    const token = getStoredToken();
    if (!token) {
      setFailed(true);
      return () => {
        active = false;
      };
    }

    void fetch(src, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Image unavailable");
        }
        return response.blob();
      })
      .then((blob) => {
        if (!active) {
          return;
        }
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [src]);

  if (failed) {
    return <div className="image-placeholder">Image unavailable</div>;
  }

  if (!objectUrl) {
    return <div className="image-placeholder">Loading...</div>;
  }

  return <img src={objectUrl} alt={alt} className="verification-image" />;
}
