import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Theme = "dark" | "light";

type Props = {
  iconNames: string[];
};

const SEARCH_LIMIT = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildIconUrl(origin: string, icons: string[], theme: Theme, perLine: number) {
  const url = new URL("/icons", origin);
  if (icons.length === 0) return "";
  url.searchParams.set("i", icons.join(","));
  url.searchParams.set("theme", theme);
  url.searchParams.set("perline", String(perLine));
  return url.toString();
}

export default function Landing({ iconNames }: Props) {
  const reducedMotion = useReducedMotion();
  const searchInputId = useId();

  const [selectedIcons, setSelectedIcons] = useState<string[]>([]);
  const [customIcons, setCustomIcons] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>("dark");
  const [perLine, setPerLine] = useState<number>(3);

  const [query, setQuery] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [uploadStatus, setUploadStatus] = useState<{ kind: "idle" | "ok" | "error"; text: string }>({
    kind: "idle",
    text: "",
  });

  const searchRef = useRef<HTMLInputElement | null>(null);
  const searchAreaRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const urlRef = useRef<HTMLInputElement | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const uploadClearTimeoutRef = useRef<number | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";

  const filteredIcons = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? iconNames.filter((name) => name.includes(q)) : iconNames;
    return pool.slice(0, SEARCH_LIMIT);
  }, [iconNames, query]);

  const selectedAll = useMemo(() => [...selectedIcons, ...customIcons], [customIcons, selectedIcons]);

  const iconUrl = useMemo(() => buildIconUrl(origin, selectedAll, theme, perLine), [origin, perLine, selectedAll, theme]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setSearchOpen(true);
        queueMicrotask(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        });
        return;
      }
      if (key === "escape") {
        if (searchOpen) {
          event.preventDefault();
          setSearchOpen(false);
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!searchOpen) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (searchAreaRef.current?.contains(target)) return;
      setSearchOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [searchOpen]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      if (uploadClearTimeoutRef.current) window.clearTimeout(uploadClearTimeoutRef.current);
    };
  }, []);

  function toggleIcon(icon: string) {
    setSelectedIcons((prev) => {
      if (prev.includes(icon)) return prev.filter((value) => value !== icon);
      return [...prev, icon];
    });
  }

  function clearAll() {
    setSelectedIcons([]);
    setCustomIcons([]);
    setQuery("");
    setSearchOpen(false);
    setHighlightedIndex(0);
    setCopyState("idle");
    setUploadStatus({ kind: "idle", text: "" });
  }

  function stepPerLine(delta: number) {
    setPerLine((prev) => clamp(prev + delta, 1, 10));
  }

  async function onCopy() {
    if (!iconUrl) return;
    try {
      await navigator.clipboard.writeText(iconUrl);
      setCopyState("copied");
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
    }
  }

  async function handleUpload(file: File) {
    if (file.type !== "image/svg+xml") {
      setUploadStatus({ kind: "error", text: "Only SVG files allowed." });
      return;
    }

    setUploadStatus({ kind: "idle", text: "Uploading…" });
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/custom-icons/upload", { method: "POST", body: formData });
      if (!res.ok) {
        setUploadStatus({ kind: "error", text: `Upload failed (${res.status}).` });
        return;
      }
      const data = (await res.json()) as { objectPath?: string };
      if (!data.objectPath) {
        setUploadStatus({ kind: "error", text: "Bad upload response." });
        return;
      }

      setCustomIcons((prev) => [...prev, `custom:${data.objectPath}`]);
      setUploadStatus({ kind: "ok", text: "Uploaded." });

      if (uploadClearTimeoutRef.current) window.clearTimeout(uploadClearTimeoutRef.current);
      uploadClearTimeoutRef.current = window.setTimeout(() => {
        setUploadStatus({ kind: "idle", text: "" });
      }, 2400);
    } catch {
      setUploadStatus({ kind: "error", text: "Upload error." });
    }
  }

  const springPress = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 };

  return (
    <div className="landing">
      <header className="topbar">
        <div className="brand">
          <div className="brandText">
            <div className="brandTitleRow">
              <h1 className="brandTitle">ren0va</h1>
              <motion.svg
                className="brandMarking"
                viewBox="0 0 320 64"
                preserveAspectRatio="none"
                aria-hidden="true"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.12 } }}
              >
                <motion.path
                  // Full-width highlight: left -> right with a slight oblique lift (3rd -> 1st quadrant feel)
                  d="M8 46 C 66 28, 132 54, 192 40 S 268 30, 312 36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reducedMotion ? false : { pathLength: 0, opacity: 0.32 }}
                  animate={{
                    pathLength: 1,
                    opacity: 0.42,
                    transition: { type: "spring", stiffness: 280, damping: 28, mass: 0.7 },
                  }}
                />
                <motion.path
                  d="M12 54 C 74 36, 138 60, 204 46 S 276 38, 316 44"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reducedMotion ? false : { pathLength: 0, opacity: 0.26 }}
                  animate={{
                    pathLength: 1,
                    opacity: 0.34,
                    transition: { type: "spring", stiffness: 240, damping: 30, mass: 0.8, delay: 0.06 },
                  }}
                />
              </motion.svg>
            </div>
          </div>
        </div>

        <nav className="topActions" aria-label="Links">
          <a className="iconLink" href="#" aria-label="Docs" aria-disabled="true" onClick={(e) => e.preventDefault()}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 4.5h9a2 2 0 0 1 2 2V20a1 1 0 0 1-1.447.894L12 18.5l-4.553 2.394A1 1 0 0 1 6 20V6.5a2 2 0 0 1 1-2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M9 8.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M9 11.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </a>
          <a
            className="iconLink"
            href="https://github.com/dexisback/renova"
            aria-label="GitHub"
            target="_blank"
            rel="noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2.6a9.4 9.4 0 0 0-2.97 18.32c.47.09.64-.2.64-.45v-1.64c-2.6.57-3.15-1.1-3.15-1.1-.43-1.08-1.06-1.37-1.06-1.37-.86-.57.06-.56.06-.56.95.07 1.45.98 1.45.98.85 1.45 2.23 1.03 2.78.79.09-.62.33-1.03.6-1.27-2.08-.24-4.27-1.04-4.27-4.63 0-1.02.37-1.86.98-2.52-.1-.24-.42-1.2.09-2.5 0 0 .8-.26 2.62.96a9.04 9.04 0 0 1 4.78 0c1.82-1.22 2.62-.96 2.62-.96.51 1.3.2 2.26.1 2.5.6.66.98 1.5.98 2.52 0 3.6-2.19 4.39-4.28 4.62.35.3.66.9.66 1.82v2.7c0 .25.16.55.64.45A9.4 9.4 0 0 0 12 2.6Z"
                fill="currentColor"
                opacity="0.92"
              />
            </svg>
          </a>
          <a className="iconLink" href="#" aria-label="Twitter" aria-disabled="true" onClick={(e) => e.preventDefault()}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18.8 7.2c.01.18.01.37.01.55 0 5.6-4.26 12.05-12.05 12.05-2.39 0-4.6-.7-6.46-1.9.33.04.66.05 1 .05 1.98 0 3.8-.67 5.25-1.8a4.24 4.24 0 0 1-3.96-2.95c.26.04.52.07.8.07.38 0 .77-.05 1.13-.15a4.23 4.23 0 0 1-3.39-4.15v-.06c.57.32 1.22.51 1.92.53a4.24 4.24 0 0 1-1.31-5.64 12.03 12.03 0 0 0 8.74 4.43 4.23 4.23 0 0 1 7.2-3.86 8.4 8.4 0 0 0 2.69-1.03 4.22 4.22 0 0 1-1.86 2.34 8.44 8.44 0 0 0 2.43-.66 9.08 9.08 0 0 1-2.12 2.2Z"
                fill="currentColor"
                opacity="0.92"
              />
            </svg>
          </a>
        </nav>
      </header>

      <section className="urlBar" aria-label="Share">
        <div className="urlField" aria-label="Generated URL">
          <input
            ref={urlRef}
            className="urlInput"
            value={iconUrl || ""}
            placeholder="Select icons to generate a URL…"
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            aria-readonly="true"
          />
        </div>
        <motion.button
          type="button"
          className={`primaryBtn ${copyState === "copied" ? "btnOk" : ""}`}
          onClick={onCopy}
          disabled={!iconUrl}
          whileTap={reducedMotion ? undefined : { scale: 0.98 }}
          transition={springPress}
        >
          {copyState === "copied" ? "Copied" : "Copy URL"}
        </motion.button>
      </section>

      <section className="grid" aria-label="Generator">
        <div className="previewWrap">
          <div className="previewHeader">
            <div>
              <p className="sectionLabel">Preview</p>
              <p className="sectionTitle">Live sprite output</p>
            </div>
            <motion.button
              type="button"
              className="ghostBtn"
              onClick={clearAll}
              disabled={selectedAll.length === 0}
              whileTap={reducedMotion ? undefined : { scale: 0.98 }}
              transition={springPress}
            >
              Clear
            </motion.button>
          </div>

          <div className="previewFrame" role="img" aria-label="Icon sprite preview">
            {iconUrl ? (
              <img className="previewImage" src={iconUrl} alt="" loading="eager" />
            ) : (
              <div className="previewEmpty">
                <div className="previewEmptyTitle">Nothing to preview</div>
                <div className="previewEmptyHint">Pick a couple of icons on the right.</div>
              </div>
            )}
          </div>
        </div>

        <aside className="controls" aria-label="Controls">
          <div className="controlBlock">
            <div className="controlHeader">
              <div>
                <p className="sectionLabel">Icons</p>
                <p className="sectionTitle">Search & select</p>
              </div>
              <span className="kbd" aria-hidden="true">
                Ctrl K
              </span>
            </div>

            <div className="searchArea" ref={searchAreaRef}>
              <label className="srOnly" htmlFor={searchInputId}>
                Search icons
              </label>
              <input
                id={searchInputId}
                ref={searchRef}
                className="input"
                placeholder="Search icons (react, typescript…)"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightedIndex(0);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedIndex((prev) => clamp(prev + 1, 0, Math.max(filteredIcons.length - 1, 0)));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedIndex((prev) => clamp(prev - 1, 0, Math.max(filteredIcons.length - 1, 0)));
                  } else if (e.key === "Enter" && filteredIcons[highlightedIndex]) {
                    e.preventDefault();
                    toggleIcon(filteredIcons[highlightedIndex]);
                  } else if (e.key === "Escape") {
                    setSearchOpen(false);
                  }
                }}
              />

              <AnimatePresence initial={false}>
                {searchOpen ? (
                  <motion.div
                    className="dropdown"
                    role="listbox"
                    aria-label="Search results"
                    initial={reducedMotion ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
                    exit={{ opacity: 0, y: -4, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
                  >
                    {filteredIcons.length === 0 ? (
                      <div className="dropdownEmpty">No results.</div>
                    ) : (
                      filteredIcons.map((name, idx) => {
                        const active = idx === highlightedIndex;
                        const selected = selectedIcons.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={`option ${active ? "active" : ""} ${selected ? "selected" : ""}`}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggleIcon(name)}
                          >
                            <span className="optionName">{name}</span>
                            {selected ? <span className="optionHint">Selected</span> : <span className="optionHint">Add</span>}
                          </button>
                        );
                      })
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="chipRow" aria-label="Selected icon chips">
              {selectedIcons.length === 0 ? (
                <span className="muted">No icons selected.</span>
              ) : (
                selectedIcons.slice(0, 18).map((name) => (
                  <button key={name} type="button" className="chip" onClick={() => toggleIcon(name)} aria-label={`Remove ${name}`}>
                    {name}
                    <span className="chipX" aria-hidden="true">
                      ×
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="controlBlock">
            <div className="controlHeader">
              <div>
                <p className="sectionLabel">Layout</p>
                <p className="sectionTitle">Grid settings</p>
              </div>
            </div>

            <div className="settingsGrid">
              <div className="setting">
                <p className="settingLabel">Icons per line</p>
                <div className="seg">
                  <motion.button
                    type="button"
                    className="segBtn"
                    onClick={() => stepPerLine(-1)}
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    transition={springPress}
                    aria-label="Decrease icons per line"
                  >
                    −
                  </motion.button>
                  <div className="segValue" aria-label="Icons per line value">
                    {perLine}
                  </div>
                  <motion.button
                    type="button"
                    className="segBtn"
                    onClick={() => stepPerLine(1)}
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    transition={springPress}
                    aria-label="Increase icons per line"
                  >
                    +
                  </motion.button>
                </div>
              </div>

              <div className="setting">
                <p className="settingLabel">Theme</p>
                <div className="seg two">
                  <motion.button
                    type="button"
                    className={`segBtn ${theme === "dark" ? "active" : ""}`}
                    onClick={() => setTheme("dark")}
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    transition={springPress}
                  >
                    Dark
                  </motion.button>
                  <motion.button
                    type="button"
                    className={`segBtn ${theme === "light" ? "active" : ""}`}
                    onClick={() => setTheme("light")}
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    transition={springPress}
                  >
                    Light
                  </motion.button>
                </div>
              </div>
            </div>
          </div>

          <div className="controlBlock">
            <div className="controlHeader">
              <div>
                <p className="sectionLabel">Custom</p>
                <p className="sectionTitle">Upload an SVG</p>
              </div>
            </div>

            <div className="uploadRow">
              <input
                ref={fileRef}
                type="file"
                accept="image/svg+xml"
                className="srOnly"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                  e.target.value = "";
                }}
              />
              <motion.button
                type="button"
                className="secondaryBtn"
                onClick={() => fileRef.current?.click()}
                whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                transition={springPress}
              >
                Choose file
              </motion.button>

              <div className={`status ${uploadStatus.kind}`} aria-live="polite">
                {uploadStatus.text}
              </div>
            </div>
          </div>
        </aside>
      </section>

      <footer className="footer">
        <p className="footerText">
          Tip: press <span className="kbdInline">Ctrl K</span> to search icons fast.
        </p>
      </footer>
    </div>
  );
}
