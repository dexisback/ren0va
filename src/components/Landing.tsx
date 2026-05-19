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
          <span className="brandMark" aria-hidden="true">
            r
          </span>
          <div className="brandText">
            <h1 className="brandTitle">ren0va</h1>
            <p className="brandTagline">Generate minimal icon grids for docs, slides, and prototypes.</p>
          </div>
        </div>

        <nav className="topActions" aria-label="Links">
          <a className="topLink" href="#" aria-disabled="true" onClick={(e) => e.preventDefault()}>
            Docs
          </a>
          <a className="topLink" href="https://github.com/dexisback/renova" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="topLink" href="#" aria-disabled="true" onClick={(e) => e.preventDefault()}>
            TWT
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
