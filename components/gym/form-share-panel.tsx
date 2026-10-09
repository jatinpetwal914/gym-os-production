'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, MessageCircle, RotateCcw, Share2 } from 'lucide-react';
import { clientPublicFormUrl } from '@/lib/gym-forms';

export function whatsappShareUrl(formName: string, url: string) {
  const text = `Please fill out the ${formName} using the link below:\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function FormSharePanel({
  publicId,
  formName,
  compact,
}: {
  publicId: string;
  formName: string;
  compact?: boolean;
}) {
  const url = clientPublicFormUrl(publicId);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: compact ? 180 : 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#2064B6', light: '#FFFFFF' },
    }).then((data) => {
      if (!cancelled) setQr(data);
    });
    return () => {
      cancelled = true;
    };
  }, [url, compact]);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: formName, text: `Please fill out ${formName}`, url });
    } else {
      await copy();
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={`QR code for ${formName}`} className="h-40 w-40 rounded-lg border border-[#DAE1E7] bg-white" />
      ) : (
        <div className="h-40 w-40 rounded-lg border border-dashed border-[#DAE1E7]" />
      )}
      <p className="break-all text-xs text-slate-400">{url}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={copy} className="admin-secondary-btn">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Copy link
        </button>
        <a href={qr || undefined} download={`${formName.replace(/\s+/g, '-').toLowerCase()}-qr.png`} className="admin-secondary-btn">
          <Download className="h-4 w-4" />
          Download QR
        </a>
        <a href={whatsappShareUrl(formName, url)} target="_blank" rel="noreferrer" className="admin-secondary-btn">
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
        <button type="button" onClick={nativeShare} className="admin-secondary-btn">
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </div>
  );
}

export function FlipBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="admin-secondary-btn">
      <RotateCcw className="h-4 w-4" />
      Flip back
    </button>
  );
}
