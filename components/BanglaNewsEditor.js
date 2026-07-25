"use client";

import { useState, useEffect } from "react";
import styles from "./BanglaNewsEditor.module.css";

export default function BanglaNewsEditor() {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState("");
  
  const [activeTab, setActiveTab] = useState(""); 
  const [isClean, setIsClean] = useState(false);  
  
  const [rewritten, setRewritten] = useState("");
  const [english, setEnglish] = useState("");
  const [changes, setChanges] = useState([]);
  const [focusMode, setFocusMode] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;

  useEffect(() => {
    const savedDraft = localStorage.getItem("newsWizardDraft");
    if (savedDraft) setText(savedDraft);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("newsWizardDraft", text);
    }, 1000);
    return () => clearTimeout(timer);
  }, [text]);

  const handleTextChange = (e) => {
    setText(e.target.value);
    setIsClean(false); // Only resets if they edit in the main top editor
  };

  const checkSpelling = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setLoadingType("spell");
    
    try {
      const response = await fetch("/api/check-spelling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Server returned ${response.status}`);
      }
      
      const errorsList = data.errors || (data.result && data.result.errors) || [];
      setErrors(errorsList);
      
      if (errorsList.length === 0) {
        setIsClean(true);
        setActiveTab("শুদ্ধ");
        alert(data.summary || "কোনো বানান ভুল পাওয়া যায়নি।");
      } else {
        setIsClean(false);
        setActiveTab("ভুল");
      }
      
    } catch (error) {
      console.error("Spell check failed:", error);
      alert(`সার্ভার এরর: ${error.message}. Console চেক করুন।`);
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  };

  const rewriteNews = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setLoadingType("rewrite");
    
    try {
      const response = await fetch("/api/rewrite-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
         throw new Error(data.error || `Server returned ${response.status}`);
      }
      
      const newRewritten = data.rewritten || (data.result && data.result.rewritten) || "";
      const newEnglish = data.english || (data.result && data.result.english) || "";
      const newChanges = data.changes || (data.result && data.result.changes) || [];
      
      setRewritten(newRewritten);
      setEnglish(newEnglish);
      setChanges(newChanges);
      
      if (newRewritten) {
        setActiveTab("সম্পাদিত");
      } else {
        alert("সম্পাদনা করা সম্ভব হয়নি।");
      }
      
    } catch (error) {
      console.error("Rewrite failed:", error);
      alert(`সার্ভার এরর: ${error.message}. Console চেক করুন।`);
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  };

  const handleSuggestionChange = (index, newSuggestion) => {
    const newErrors = [...errors];
    newErrors[index].suggestion = newSuggestion;
    setErrors(newErrors);
  };

  const fixAll = () => {
    let newText = text;
    errors.forEach(err => {
      newText = newText.replace(new RegExp(err.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), 'g'), err.suggestion);
    });
    setText(newText);
    setErrors([]);
    setIsClean(true);
    setActiveTab("শুদ্ধ");
  };

  const fixOne = (index) => {
    const err = errors[index];
    const newText = text.replace(new RegExp(err.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), 'g'), err.suggestion);
    setText(newText);
    
    const newErrors = [...errors];
    newErrors.splice(index, 1);
    setErrors(newErrors);
    
    if (newErrors.length === 0) {
      setIsClean(true);
      setActiveTab("শুদ্ধ");
    }
  };

  const ignoreOne = (index) => {
    const newErrors = [...errors];
    newErrors.splice(index, 1);
    setErrors(newErrors);
    
    if (newErrors.length === 0) {
      setIsClean(true);
      setActiveTab("শুদ্ধ");
    }
  };

  const handleCopy = (textToCopy) => {
    if (!textToCopy.trim()) return;
    navigator.clipboard.writeText(textToCopy);
    setCopyMsg("✓ কপি করা হয়েছে!");
    setTimeout(() => setCopyMsg(""), 2000);
  };

  return (
    <div className={`${styles.page} ${focusMode ? styles.focusMode : ""}`}>
      <header className={styles.masthead}>
        <div className={styles.mastheadInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>শুদ্ধি</span>
            <span className={styles.logoSub}>| বানান সম্পাদনা</span>
          </div>
        </div>
      </header>

      <main className={styles.layout}>
        <div className={styles.editorColumn}>
          
          <div className={styles.editorCard}>
            <textarea
              className={styles.textarea}
              value={text}
              onChange={handleTextChange}
              placeholder="এখানে সংবাদ লিখুন..."
              spellCheck="false"
            />

            <div className={styles.actionBar}>
              <button 
                className={`${styles.btn} ${styles.btnSpell} ${loading || !text.trim() ? styles.btnDisabled : ""}`} 
                onClick={checkSpelling} 
                disabled={loading || !text.trim()}
              >
                {loadingType === "spell" ? "পরীক্ষা চলছে…" : "✓ বানান পরীক্ষা"}
              </button>
              
              <button 
                className={`${styles.btn} ${styles.btnEdit} ${loading || !text.trim() ? styles.btnDisabled : ""}`} 
                onClick={rewriteNews} 
                disabled={loading || !text.trim()}
              >
                {loadingType === "rewrite" ? "সম্পাদনা চলছে…" : "✎ সম্পাদনা + ইংরেজি"}
              </button>
              
              <button className={`${styles.btn} ${styles.btnFocus}`} onClick={() => setFocusMode(!focusMode)}>
                {focusMode ? "⛶ সাধারণ মোড" : "🔍 ফোকাস মোড"}
              </button>
            </div>
          </div>

          {/* Only render Tabs and Panel if an action has been taken */}
          {activeTab && (
            <>
              <div className={styles.tabs}>
                {errors.length > 0 && (
                  <button 
                    className={`${styles.tab} ${activeTab === "ভুল" ? styles.tabActive : ""}`} 
                    onClick={() => setActiveTab("ভুল")}
                  >
                    ভুল {errors.length > 0 && `(${errors.length})`}
                  </button>
                )}
                
                {isClean && (
                  <button 
                    className={`${styles.tab} ${activeTab === "শুদ্ধ" ? styles.tabActive : ""}`} 
                    onClick={() => setActiveTab("শুদ্ধ")}
                  >
                    ✅ শুদ্ধ
                  </button>
                )}

                {rewritten && (
                  <button 
                    className={`${styles.tab} ${activeTab === "সম্পাদিত" ? styles.tabActive : ""}`} 
                    onClick={() => setActiveTab("সম্পাদিত")}
                  >
                    ✨ সম্পাদিত
                  </button>
                )}
              </div>

              <div className={styles.panel}>
                {activeTab === "শুদ্ধ" && (
                   <div className={styles.resultSection}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 className={styles.resultTitle} style={{ margin: 0, borderBottom: 'none' }}>শুদ্ধ পাঠ</h3>
                        <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => handleCopy(text)}>
                           {copyMsg || "📋 কপি করুন"}
                        </button>
                     </div>
                     <textarea 
                       className={styles.editableResult} 
                       value={text} 
                       onChange={(e) => setText(e.target.value)} 
                       spellCheck="false"
                       title="আপনি চাইলে লেখাটি এখানে সম্পাদনা করতে পারেন"
                     />
                   </div>
                )}

                {activeTab === "ভুল" && (
                  <div>
                    {errors.length === 0 ? (
                      <p className={styles.previewBox}>কোনো বানান ভুল পাওয়া যায়নি।</p>
                    ) : (
                      <>
                        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                           <button className={`${styles.btn} ${styles.btnOutline}`} onClick={fixAll}>
                             সব একসাথে ঠিক করুন
                           </button>
                        </div>
                        <div className={styles.errorList}>
                          {errors.map((err, idx) => (
                            <div key={idx} className={styles.errorItem}>
                              <div className={styles.errorDetails}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span className={styles.errorWord}>{err.word}</span>
                                  <span> → </span>
                                  <input 
                                    type="text" 
                                    value={err.suggestion} 
                                    onChange={(e) => handleSuggestionChange(idx, e.target.value)}
                                    className={styles.suggestionInput}
                                    title="আপনি চাইলে নিজে সম্পাদনা করতে পারেন"
                                  />
                                </div>
                                <div className={styles.errorRule}>{err.rule}</div>
                              </div>
                              <div className={styles.errorActions}>
                                <button className={`${styles.btn} ${styles.btnIgnore}`} onClick={() => ignoreOne(idx)}>
                                  এড়িয়ে যান
                                </button>
                                <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => fixOne(idx)}>
                                  ঠিক করুন
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "সম্পাদিত" && rewritten && (
                  <div>
                    <div className={styles.resultSection}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                         <h3 className={styles.resultTitle} style={{ margin: 0, borderBottom: 'none' }}>সম্পাদিত বাংলা</h3>
                         <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => handleCopy(rewritten)}>
                            {copyMsg || "📋 কপি করুন"}
                         </button>
                      </div>
                      <textarea 
                         className={styles.editableResult} 
                         value={rewritten} 
                         onChange={(e) => setRewritten(e.target.value)} 
                         spellCheck="false"
                      />
                    </div>

                    {english && (
                      <div className={styles.resultSection}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                           <h3 className={styles.resultTitle} style={{ margin: 0, borderBottom: 'none' }}>English Translation</h3>
                           <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => handleCopy(english)}>
                              {copyMsg || "📋 Copy"}
                           </button>
                         </div>
                         <textarea 
                           className={styles.editableResult} 
                           value={english} 
                           onChange={(e) => setEnglish(e.target.value)} 
                           spellCheck="false"
                         />
                      </div>
                    )}

                    {changes && changes.length > 0 && (
                      <div className={styles.resultSection}>
                        <h3 className={styles.resultTitle}>পরিবর্তন সমূহ</h3>
                        <ul className={styles.changesList}>
                          {changes.map((change, idx) => (
                            <li key={idx}>{change}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <aside className={styles.sidebar}>
          <details className={styles.sideCard} open>
            <summary>📊 পরিসংখ্যান</summary>
            <div className={styles.sideCardBody}>
               <div className={styles.statRow}>
                 <span>শব্দ সংখ্যা:</span>
                 <strong>{wordCount}</strong>
               </div>
               <div className={styles.statRow}>
                 <span>অক্ষর সংখ্যা:</span>
                 <strong>{charCount}</strong>
               </div>
               <div className={styles.statRow}>
                 <span>বানান ভুল:</span>
                 <strong style={{ color: 'var(--accent)' }}>{errors.length}</strong>
               </div>
            </div>
          </details>

          <details className={styles.sideCard}>
            <summary>📖 বানান নির্দেশিকা</summary>
            <div className={styles.sideCardBody}>
              <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
                <li style={{ marginBottom: '0.5rem' }}>বিদেশি শব্দে ই-কার ব্যবহার হয় (যেমন: অ্যাকাডেমি, চাকরি)।</li>
                <li style={{ marginBottom: '0.5rem' }}>তৎসম শব্দ ছাড়া 'ণ' ব্যবহৃত হয় না (যেমন: গভর্নর, হর্ন)।</li>
                <li style={{ marginBottom: '0.5rem' }}>'শ্রেণি', 'মূর্তি' ইত্যাদিতে ই-কার বসবে।</li>
                <li>বাংলা সংবাদে ইংরেজি সংখ্যা (0-9) ব্যবহার করা যাবে না।</li>
              </ul>
            </div>
          </details>
        </aside>
      </main>

      <footer className={styles.footer}>
        <p>
          Built by <strong>Towfiqul Alam</strong> | Contact:{" "}
          <a href="mailto:towfiqul.pro@gmail.com">towfiqul.pro@gmail.com</a>
        </p>
      </footer>
    </div>
  );
}
