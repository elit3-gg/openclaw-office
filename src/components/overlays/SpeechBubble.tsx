import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";
import type { VisualAgent } from "@/gateway/types";

interface SvgOverlayBounds {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
}

interface SpeechBubbleOverlayProps {
  agent: VisualAgent;
  overlayBounds?: SvgOverlayBounds;
}

export function SpeechBubbleOverlay({ agent, overlayBounds }: SpeechBubbleOverlayProps) {
  const { t } = useTranslation("common");
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const speechText = agent.speechBubble?.text ?? "";

  useEffect(() => {
    setDismissed(false);
    setVisible(true);
  }, [speechText]);

  useEffect(() => {
    if (dismissed) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [dismissed]);

  if (!agent.speechBubble || !visible || dismissed) {
    return null;
  }

  // Convert SVG coordinates to container pixel offsets
  const pixelX = overlayBounds
    ? overlayBounds.left + agent.position.x * overlayBounds.scaleX
    : agent.position.x;
  const pixelY = overlayBounds
    ? overlayBounds.top + agent.position.y * overlayBounds.scaleY
    : agent.position.y;

  // Use percentage of container for positioning
  const nearLeft = pixelX < (overlayBounds ? overlayBounds.left + (overlayBounds.scaleX * 300) : 300);
  const nearRight = pixelX > (overlayBounds ? overlayBounds.left + overlayBounds.scaleX * 900 : 900);

  let translateX = "-50%";
  let arrowAlign: "center" | "left" | "right" = "center";
  if (nearLeft) {
    translateX = "-10%";
    arrowAlign = "left";
  } else if (nearRight) {
    translateX = "-90%";
    arrowAlign = "right";
  }

  const avatarOffsetPx = overlayBounds ? 52 * overlayBounds.scaleY : 52;

  return (
    <div
      className="pointer-events-none absolute"
      data-testid="speech-bubble-anchor"
      style={{
        left: `${pixelX}px`,
        top: `${pixelY}px`,
        transform: `translate(${translateX}, -100%) translateY(-${avatarOffsetPx}px)`,
        opacity: 1,
        transition: "opacity 300ms ease",
        zIndex: 21,
      }}
    >
      <div
        className="pointer-events-auto min-w-[320px] w-[min(54vw,520px)] max-w-[min(94vw,560px)] max-h-[40vh] overflow-y-auto rounded-2xl border border-slate-300/80 bg-white px-4 py-3.5 text-[14px] leading-7 text-slate-900 shadow-2xl [overflow-wrap:anywhere] dark:border-slate-600/90 dark:bg-slate-900 dark:text-slate-100"
        data-testid="speech-bubble-overlay"
      >
        <div className="mb-2 flex items-start justify-end">
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              setVisible(false);
            }}
            aria-label={t("actions.close")}
            className="rounded-md px-1.5 py-0.5 text-sm leading-none text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            ×
          </button>
        </div>
        <div className="[&_p]:my-0 [&_p+*]:mt-2.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5">
          <Markdown>{agent.speechBubble.text}</Markdown>
        </div>
      </div>
      <div
        className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-gray-200 dark:border-t-gray-700"
        data-testid={`speech-bubble-arrow-${arrowAlign}`}
        style={{
          marginLeft: arrowAlign === "left" ? "16px" : "auto",
          marginRight: arrowAlign === "right" ? "16px" : "auto",
        }}
      />
    </div>
  );
}
