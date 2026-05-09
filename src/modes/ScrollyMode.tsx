import { useEffect, useRef, useState } from "react";
import { SHOTS } from "./scrollyShots";
import { useRig } from "../state/rigStore";
import { useApp } from "../state/store";
import { faceMeta } from "../content/concepts";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ScrollyMode() {
  const asideRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Drive camera + face highlight from whichever section is most in view
  // within the aside's own scroll container.
  useEffect(() => {
    const root = asideRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (!visible.length) return;
        const idx = Number(visible[0].target.getAttribute("data-shot"));
        if (Number.isNaN(idx)) return;
        setActiveIndex(idx);
        const shot = SHOTS[idx];
        const c = useRig.getState().controls;
        if (!c) return;
        c.setLookAt(
          shot.eye[0], shot.eye[1], shot.eye[2],
          shot.look[0], shot.look[1], shot.look[2],
          !prefersReducedMotion(),
        );
        useApp.setState({ activeFace: shot.face, activeConcept: null });
      },
      { root, threshold: [0.4, 0.65, 0.9], rootMargin: "-30% 0px -30% 0px" },
    );
    sectionRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const activeShot = SHOTS[activeIndex];
  const activeMeta = activeShot.face ? faceMeta(activeShot.face) : null;

  return (
    <aside
      className="scrolly"
      aria-label="Scrollytelling narrative"
      ref={asideRef}
    >
      <div className="scrolly-progress" aria-hidden>
        <div
          className="scrolly-progress-bar"
          style={{ width: `${((activeIndex + 1) / SHOTS.length) * 100}%` }}
        />
      </div>
      <div className="scrolly-track">
        {SHOTS.map((shot, i) => (
          <section
            key={shot.id}
            ref={(el) => { sectionRefs.current[i] = el; }}
            data-shot={i}
            className="scrolly-section"
            data-active={i === activeIndex}
          >
            {shot.face && (
              <div
                className="scrolly-face-tag"
                style={{ color: faceMeta(shot.face).color }}
              >
                {faceMeta(shot.face).title}
              </div>
            )}
            <h2>{shot.title}</h2>
            <p>{shot.body}</p>
          </section>
        ))}
      </div>
      {/* spacer so the last section can scroll to center */}
      <div className="scrolly-spacer" aria-hidden />
      {/* aria-live region announcing the current shot */}
      <div className="sr-only" aria-live="polite">
        {activeMeta ? `${activeMeta.title}: ` : ""}{activeShot.title}
      </div>
    </aside>
  );
}
