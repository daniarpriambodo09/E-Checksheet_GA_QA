

"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GaugeScanModal } from "@/components/GaugeScanModal";

export default function ScanQRPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(true);
  const [scannedData, setScannedData] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    startScanner();
    return () => stopScanner();
  }, []);

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const stopScanner = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleScan = (data: string) => {
    setScannedData(data);
    stopScanner();
    
    // Parse QR data dan redirect
    if (data.startsWith("GAUGE:")) {
      router.push(`/gauge-inspection?code=${data}`);
    } else if (data.startsWith("CHECKLIST:")) {
      router.push(`/checklist/${data.split(":")[1]}`);
    } else {
      router.push(`/home?scan=${encodeURIComponent(data)}`);
    }
  };

  return (
    <div className="scan-qr-container">
      <div className="scan-header">
        <button onClick={() => router.back()}>← Kembali</button>
        <h1>Scan QR Code</h1>
      </div>
      
      <div className="scan-viewfinder">
        <video ref={videoRef} autoPlay playsInline />
        <div className="scan-overlay" />
      </div>
      
      <div className="scan-instructions">
        <p>Arahkan kamera ke QR Code</p>
      </div>
    </div>
  );
}