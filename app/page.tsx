'use client'

import './App.css';
import { useState, useEffect } from "react";
import * as Tone from 'tone';

type PolySynthOrNull = Tone.PolySynth<Tone.Synth<Tone.SynthOptions>> | null;

function App() {
  const metersCount = 5;

  const [meters, setMeters] = useState(["3", "4", "5", "", ""]);
  const [enableds, setEnableds] = useState([true, true, true, false, false]);
  const [linePosition, setLinePosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(80);
  const [synth, setSynth] = useState<PolySynthOrNull>(null);

  // 参考文献: https://note.com/sunajiro/n/nbf9fffb2fbc0
  const baseNotes = [
    "",
    "D4", "A4", "B4", "D5",
    "F#5", "A5", "C#6", "D6",
    "E6", "F#6", "A6", "B6", "C#7",
    "E7", "F#7", "A7"
  ]; 

  const getNote = (meter: number) => {
    if (meter <= 16) {
      return baseNotes[meter];
    } else {
      // 8-12が6, 13-17が7, ...
      const octave = Math.floor((meter - 8) / 5) + 6;
      const key = ["C#", "E", "F#", "A", "B"][(meter - 8) % 5];
      return `${key}${octave}`;
    }
  }

  const play = (notes: string[]) => {
    synth!.triggerAttackRelease(notes, "8n"); 
  }

  // Rubyの(0...n).to_aに相当する
  const zeroToBefore = (n: number|string) => {
    const num = parseInt(`${n}`);
    return [...Array(num >= 1 ? num : 1).keys()];
  }

  const parseIntOrOne = (str: string) => parseInt(str) >= 1 ? parseInt(str) : 1;

  const coerceToIntOrEmpty = (str: string) => parseInt(str) >= 1 ? parseInt(str) : "";

  const meterChangeHandler = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetValue = parseInt(e.target.value);
    const newMeters = meters.map((meter, j) => ( i === j ? `${coerceToIntOrEmpty(targetValue)}` : meter ));
    setMeters(newMeters);
  };

  const enabledChangeHandler = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnableds = enableds.map((enabled, j) => ( i === j ? e.target.checked : enabled ));
    setEnableds(newEnableds);
  };

  const bpmChangeHandler = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBpm(parseInt(e.target.value));
  };

  const playHandler = () => {
    setIsPlaying(prevState => !prevState);
  };

  // シンセ設定
  useEffect(() => {
    // シンセサイザーを初期化
    const newSynth = new Tone.PolySynth();
    newSynth.toDestination();
    setSynth(newSynth);
    
    // クリーンアップ
    return () => {
      if (newSynth) {
        newSynth.dispose();
      }
    };
  }, []);

  let interval: ReturnType<typeof setTimeout>;
  useEffect(() => {
    const dt = 0.04;
    const period = 60.0 / bpm * 4;
    const dxRatio = dt / period;
    const redLineWrapperWidth = window.getComputedStyle(document.getElementById("red-line-wrapper")!)["width"];
    const boxWidth = Number(redLineWrapperWidth.replace("px", ""));
    const dx = dxRatio * boxWidth;
    console.log(dt, period, dxRatio, boxWidth, dx);
    if (isPlaying) {
      interval = setInterval(() => {
        setLinePosition((position) => {
          // 端まで達したらループ
          const newPosition = (position + dx) % boxWidth;

          const notes: string[] = [];

          if (position <= 0 || newPosition < position) {
            notes.push("G3", "D4");
            zeroToBefore(metersCount).forEach((i) => {
              const meter = parseIntOrOne(meters[i]);
              document.getElementById(`beat-${i}-${meter-1}`)?.classList.remove("glow");
              document.getElementById(`beat-${i}-0`)?.classList.add("glow");
              if (enableds[i]) {
                notes.push(getNote(meter));
              }
            });
          } else {
            zeroToBefore(metersCount).forEach((i) => {
              const meter = parseIntOrOne(meters[i]);
              zeroToBefore(meter).forEach((j) => {
                // JSでは全ての数値はdouble型である
                const targetLeftEnd = j / meter * boxWidth;
                if (position < targetLeftEnd && targetLeftEnd <= newPosition) {
                  document.getElementById(`beat-${i}-${j-1}`)?.classList.remove("glow");
                  document.getElementById(`beat-${i}-${j}`)?.classList.add("glow");
                  if (enableds[i]) {
                    notes.push(getNote(meter));
                  }
                }
              });

              if (meter === 1) {
                // 1拍子がクラスを削除した直後に同じ要素に追加するため追加処理が走らず光らないため
                // 1拍子に対しては特殊な処理を用意する
                const targetMiddle = 0.5 * boxWidth;
                if (position < targetMiddle && targetMiddle <= newPosition) {
                  document.getElementById(`beat-${i}-0`)?.classList.remove("glow");
                }
              }
            });
          }

          play(notes);

          return newPosition;
        });
      }, dt * 1000);
    }

    return () => {
      clearInterval(interval);
      setLinePosition(0);
      Array.from(document.querySelectorAll(".beat")).forEach((element) => {
        element.classList.remove("glow");
      });
    }
  }, [isPlaying, meters, enableds, bpm]);

  return (
    <div className="App">
      <h1>分数ビジュアライザ</h1>
      <div className="meter-row">
        <div className="input-wrapper">
          <label className="enabled">有効</label>
          <label className="denominator">分母</label>
        </div>
        <div className="beats-wrapper" id="red-line-wrapper">
          <div id="red-line" style={{ left: `${linePosition}px`}}></div>
        </div>
      </div>
      {
        zeroToBefore(metersCount).map((i) => {
          const meter = parseIntOrOne(meters[i]);
          const enabled = enableds[i];
          return (
            <div key={`meter-row-${i}`} className="meter-row">
              <div className="input-wrapper">
                <input type="checkbox" checked={enabled} onChange={enabledChangeHandler(i)}></input>
                <input type="string" value={coerceToIntOrEmpty(meter)} disabled={!enabled} className="denominator" onChange={meterChangeHandler(i)}></input>
              </div>
              <div className="beats-wrapper">
                {
                  zeroToBefore(meter).map((j) => (
                    <div key={`beat-${i}-${j}`} id={`beat-${i}-${j}`} className={`beat ${enabled ? "" : "disabled"}`} data-beat={`${meter}`}></div>
                  ))
                }
              </div>
            </div>
          );
        })
      }
      <div id="start-button-line">
        <button onClick={playHandler} className={`${isPlaying ? "active" : ""}`}>START/STOP</button>
        <select onChange={bpmChangeHandler} value={bpm}>
          {
            zeroToBefore(15).map((i: number) => {
              const bpm = (i + 2) * 10;
              return (
                <option key={bpm} value={bpm}>{bpm}</option>
              )
            })
          }
        </select>
      </div>
    </div>
  );
}

export default App;
