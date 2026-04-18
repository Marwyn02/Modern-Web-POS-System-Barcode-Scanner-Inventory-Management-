/* eslint-disable @typescript-eslint/no-explicit-any */
// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { useEffect, useRef, useState } from "react";
// import { Html5Qrcode } from "html5-qrcode";
// import styles from "./BarcodeScanner.module.css";

// // ── Types ────────────────────────────────────────────────────────────────────

// interface BarcodeScannerProps {
//   /** Called on each scan. Return true if the barcode matched a product. */
//   onScan: (barcode: string) => boolean;
// }

// type ScanStatus = "found" | "notfound";

// interface LastScan {
//   code: string;
//   status: ScanStatus;
// }

// // ── Component ────────────────────────────────────────────────────────────────

// export default function BarcodeScanner({ onScan }: BarcodeScannerProps) {
//   const [active, setActive] = useState<boolean>(false);
//   const [lastScan, setLastScan] = useState<LastScan | null>(null);
//   const scannerRef = useRef<any>(null);
//   const cooldownRef = useRef<boolean>(false);
//   const lastCodeRef = useRef<string>("");

//   //   useEffect(() => {
//   //     if (!active) return;

//   //     const scanner = new Html5QrcodeScanner(
//   //       "qr-reader",
//   //       {
//   //         fps: 10,
//   //         qrbox: { width: 280, height: 120 },
//   //         supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
//   //         rememberLastUsedCamera: true,
//   //         showTorchButtonIfSupported: true,
//   //       },
//   //       /* verbose= */ false,
//   //     );

//   //     scanner.render(
//   //       (decodedText: string) => {
//   //         if (cooldownRef.current || decodedText === lastCodeRef.current) return;

//   //         lastCodeRef.current = decodedText;
//   //         cooldownRef.current = true;

//   //         setTimeout(() => {
//   //           cooldownRef.current = false;
//   //           lastCodeRef.current = "";
//   //         }, 2000);

//   //         const found = onScan(decodedText);
//   //         setLastScan({
//   //           code: decodedText,
//   //           status: found ? "found" : "notfound",
//   //         });
//   //       },
//   //       () => {
//   //         /* silent failure — fires on every frame with no code */
//   //       },
//   //     );

//   //     scannerRef.current = scanner;

//   //     return () => {
//   //       scanner.clear().catch(() => {});
//   //       scannerRef.current = null;
//   //     };
//   //   }, [active, onScan]);
//   const beepRef = useRef<HTMLAudioElement | null>(null);

//   useEffect(() => {
//     beepRef.current = new Audio("/beep-07a.mp3");
//   }, []);

//   useEffect(() => {
//     if (!active) return;

//     const html5QrCode = new Html5Qrcode("qr-reader");

//     html5QrCode
//       .start(
//         { facingMode: "environment" },
//         {
//           fps: 10,
//           qrbox: { width: 280, height: 120 },
//         },
//         (decodedText: string) => {
//           if (cooldownRef.current || decodedText === lastCodeRef.current)
//             return;

//           lastCodeRef.current = decodedText;
//           cooldownRef.current = true;

//           // 🔊 Play sound
//           beepRef.current?.play().catch(() => {});

//           // 📳 Optional vibration (mobile)
//           navigator.vibrate?.(100);

//           const found = onScan(decodedText);
//           setLastScan({
//             code: decodedText,
//             status: found ? "found" : "notfound",
//           });

//           // ⏸️ Pause scanner
//           const scanner = scannerRef.current as any;

//           // ⏱️ Resume after 3 seconds
//           setTimeout(() => {
//             scanner?.resume();

//             cooldownRef.current = false;
//             lastCodeRef.current = "";
//           }, 3000); // change to 5000 if you want 5 sec
//         },
//         () => {},
//       )
//       .catch((err) => console.error(err));

//     scannerRef.current = html5QrCode as any;

//     return () => {
//       html5QrCode.stop().catch(() => {});
//       html5QrCode.clear();
//       scannerRef.current = null;
//     };
//   }, [active, onScan]);

//   const toggle = () => {
//     setActive((prev) => !prev);
//     if (active) setLastScan(null);
//   };

//   return (
//     <div className={styles.wrapper}>
//       <div className={styles.header}>
//         <span className={styles.label}>Camera Scanner</span>
//         <button
//           className={`${styles.toggleBtn} ${active ? styles.active : ""}`}
//           onClick={toggle}
//         >
//           {active ? (
//             <>
//               <StopIcon /> Stop Scanner
//             </>
//           ) : (
//             <>
//               <CamIcon /> Start Scanner
//             </>
//           )}
//         </button>
//       </div>

//       <div className={styles.body}>
//         {active ? (
//           <div className={styles.viewfinder}>
//             <div id="qr-reader" className={styles.reader} />
//           </div>
//         ) : (
//           <div className={styles.placeholder}>
//             <ScanIcon />
//             <p>
//               Click <strong>Start Scanner</strong> to activate
//               <br />
//               your camera as a barcode scanner
//             </p>
//           </div>
//         )}

//         {lastScan && (
//           <div
//             className={`${styles.scanResult} ${
//               lastScan.status === "found" ? styles.found : styles.notFound
//             }`}
//           >
//             <div className={styles.scanResultLeft}>
//               <span className={styles.scanResultLabel}>Last Scanned</span>
//               <span className={styles.scanResultCode}>{lastScan.code}</span>
//             </div>
//             <span className={styles.scanResultBadge}>
//               {lastScan.status === "found" ? "✓ Added" : "✗ Not Found"}
//             </span>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ── Icons ────────────────────────────────────────────────────────────────────

// function CamIcon() {
//   return (
//     <svg
//       width="15"
//       height="15"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       strokeWidth="2"
//     >
//       <path d="M23 7l-7 5 7 5V7z" />
//       <rect x="1" y="5" width="15" height="14" rx="2" />
//     </svg>
//   );
// }

// function StopIcon() {
//   return (
//     <svg
//       width="15"
//       height="15"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       strokeWidth="2"
//     >
//       <line x1="18" y1="6" x2="6" y2="18" />
//       <line x1="6" y1="6" x2="18" y2="18" />
//     </svg>
//   );
// }

// function ScanIcon() {
//   return (
//     <svg
//       width="52"
//       height="52"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       strokeWidth="1.2"
//     >
//       <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
//       <rect x="7" y="7" width="3" height="3" />
//       <rect x="14" y="7" width="3" height="3" />
//       <rect x="7" y="14" width="3" height="3" />
//       <rect x="14" y="14" width="3" height="3" />
//     </svg>
//   );
// }

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, FlipHorizontal, ScanLine } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BarcodeScannerProps {
  onScan: (barcode: string) => boolean;
}

type ScanStatus = "found" | "notfound";
type FacingMode = "environment" | "user";

interface LastScan {
  code: string;
  status: ScanStatus;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
];

function detectMobile(): boolean {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const [active, setActive] = useState<boolean>(false);
  const [lastScan, setLastScan] = useState<LastScan | null>(null);
  const [facing, setFacing] = useState<FacingMode>("environment");
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // This controls whether the #qr-reader div is rendered in the DOM at all.
  // We mount it BEFORE calling .start() so the library always has a real,
  // visible, measured DOM node to attach the video stream to.
  const [domReady, setDomReady] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef<boolean>(false);
  const lastCodeRef = useRef<string>("");
  const isMobileRef = useRef<boolean>(false);
  const beepRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const mobile = detectMobile();
    setIsMobile(mobile);
    isMobileRef.current = mobile;
  }, []);

  useEffect(() => {
    beepRef.current = new Audio("/beep-07a.mp3");
  }, []);

  const handleDecode = useCallback(
    (decodedText: string) => {
      if (cooldownRef.current || decodedText === lastCodeRef.current) return;
      lastCodeRef.current = decodedText;
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
        lastCodeRef.current = "";
      }, 2000);
      const found = onScan(decodedText);
      if (beepRef.current) {
        beepRef.current.currentTime = 0;
        beepRef.current.play().catch(() => {});
      }
      setLastScan({ code: decodedText, status: found ? "found" : "notfound" });
    },
    [onScan],
  );

  // Step 2: once #qr-reader is in the DOM, actually start the camera
  useEffect(() => {
    if (!domReady) return;

    let cancelled = false;

    const run = async () => {
      setError(null);
      try {
        const scanner = new Html5Qrcode("qr-reader", {
          formatsToSupport: FORMATS,
          verbose: false,
        });

        const cameraConstraint = isMobileRef.current
          ? { facingMode: facing }
          : { facingMode: "user" as FacingMode };

        await scanner.start(
          cameraConstraint,
          {
            fps: 10,
            qrbox: { width: 250, height: 110 },
            aspectRatio: 1.5,
          },
          handleDecode,
          () => {},
        );

        if (cancelled) {
          await scanner.stop().catch(() => {});
          scanner.clear();
          return;
        }

        scannerRef.current = scanner;
        setActive(true);
      } catch (err: any) {
        if (!cancelled) {
          console.error("Camera error:", err);
          setError("Could not access camera. Check browser permissions.");
          setDomReady(false);
        }
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domReady]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setActive(false);
    setDomReady(false);
    setLastScan(null);
  }, []);

  const handleStart = () => {
    setIsStarting(true);
    setError(null);
    // Mount the div first, then the useEffect above fires .start()
    setDomReady(true);
  };

  const flipCamera = useCallback(async () => {
    await stopScanner();
    const next: FacingMode = facing === "environment" ? "user" : "environment";
    setFacing(next);
    // Give the DOM a tick to unmount/remount #qr-reader cleanly
    setTimeout(() => {
      setIsStarting(true);
      setDomReady(true);
    }, 200);
  }, [facing, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Barcode Scanner</span>
          {active && (
            <Badge
              variant="outline"
              className="text-[10px] text-success border-success/40 animate-pulse"
            >
              {isMobile
                ? facing === "environment"
                  ? "📷 Rear"
                  : "🤳 Front"
                : "💻 Webcam"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isMobile && active && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={flipCamera}
            >
              <FlipHorizontal className="h-3 w-3 mr-1" />
              Flip
            </Button>
          )}

          <Button
            variant={active ? "destructive" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={active ? stopScanner : handleStart}
            disabled={isStarting}
          >
            {isStarting ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Starting…
              </span>
            ) : active ? (
              <>
                <CameraOff className="h-3 w-3 mr-1" />
                Stop
              </>
            ) : (
              <>
                <Camera className="h-3 w-3 mr-1" />
                Start Scanner
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Camera error ── */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          ⚠️ {error}
        </div>
      )}

      {/* ── Viewfinder ──
           Key insight: render the div ONLY when domReady is true so it's a
           fresh, properly-sized node every time. The scanner mounts into it
           via the useEffect above. We never use display:none / hidden here. ── */}
      {domReady && (
        <div className="rounded-md overflow-hidden bg-black w-full">
          <div id="qr-reader" className="w-full" />
        </div>
      )}

      {/* ── Placeholder (shown when scanner is off) ── */}
      {!domReady && !isStarting && (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground border rounded-md border-dashed">
          <ScanLine className="h-8 w-8 opacity-30" />
          <p className="text-xs text-center leading-relaxed">
            Click{" "}
            <span className="font-semibold text-foreground">Start Scanner</span>{" "}
            to activate
            <br />
            {isMobile ? "your rear camera" : "your webcam"} as a barcode scanner
          </p>
        </div>
      )}

      {/* ── Scan result feedback ── */}
      {lastScan && (
        <div
          className={`flex items-center justify-between rounded-md px-3 py-2 text-xs border ${
            lastScan.status === "found"
              ? "bg-success/10 border-success/30 text-success"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide opacity-70">
              Last Scanned
            </span>
            <span className="font-mono font-semibold">{lastScan.code}</span>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] ${
              lastScan.status === "found"
                ? "border-success/40 text-success"
                : "border-destructive/40 text-destructive"
            }`}
          >
            {lastScan.status === "found" ? "✓ Added to Cart" : "✗ Not Found"}
          </Badge>
        </div>
      )}
    </div>
  );
}
