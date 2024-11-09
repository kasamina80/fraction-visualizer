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

  const beatPresets = [
    [ // 1個
      [2], [3], [4], [5]
    ],
    [ // 2個
      [2, 4], [2, 6], [2, 3], [2, 5], [2, 7], [2, 12],
      [3, 6], [3, 4], [3, 5], [4, 5], [5, 6], [3, 7], [5, 7]
    ],
    [ // 3個
      [2, 2, 8], [2, 4, 8], [2, 4, 6], [2, 3, 4], [2, 3, 6],
      [2, 4, 5], [2, 3, 5], [3, 6, 9], [3, 4, 6], [3, 4, 5],
      [4, 5, 6], [2, 3, 7], [3, 6, 8], [3, 5, 7]
    ],
    [ // 4個
      [2, 3, 4, 6], [2, 4, 6, 8], [2, 3, 6, 9], [2, 4, 8, 12],
      [2, 3, 4, 5], [3, 4, 5, 6], [3, 4, 8, 12], [2, 3, 6, 7],
      [2, 3, 5, 7], [3, 5, 7, 11]
    ],
    [ // 5個
      [2, 3, 4, 5, 6], [2, 4, 6, 8, 10], [2, 3, 5, 7, 11]
    ]
  ]

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

  const coerceToNumericOrEmpty = (str: string) => parseInt(str) >= 1 ? `${parseInt(str)}` : "";

  const intArrayToStringArray = (array: number[]) => array.map((num) => `${num}`);

  const padArray = (array: any[], length = metersCount) => {
    if (array.length >= metersCount) {
      return array;
    } else {
      return Array.from({ ...array, length: length }).map((val) => val ? val : "" );
    }
  }

  const swap = (array: any[], from: number, to: number) => {
    const new_array = [...array];
    [new_array[from], new_array[to]] = [new_array[to], new_array[from]];
    return new_array;
  }

  const meterChangeHandler = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetValue: string = e.target.value;
    const newMeters = meters.map((meter, j) => ( i === j ? coerceToNumericOrEmpty(targetValue) : meter ));
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

  const metersChangeHandler = (beats: number[]) => () => {
    setMeters([...padArray(intArrayToStringArray(beats))]);
    setEnableds(zeroToBefore(metersCount).map((i) => i < beats.length));
  };

  // 重複なしでcount個の2~maxの範囲の乱数を取り出す
  const randomMetersChangeHandler = (count: number, max: number) => () => {
    const randomNums: number[] = [];

    while(randomNums.length < count && randomNums.length < max - 1) {
      let num = Math.floor(Math.random() * (max - 2 + 1)) + 2;
      if(!randomNums.includes(num)) {
        randomNums.push(num);
      }
    }

    setMeters(padArray(intArrayToStringArray(randomNums.sort((a, b) => a - b))));
    setEnableds(zeroToBefore(metersCount).map((i) => i < count))
  }

  const upsideDownHandler = () => {
    setMeters([...meters.reverse()]);
    setEnableds([...enableds.reverse()]);
  }

  const swapHandler = (from: number, to: number) => () => {
    setMeters(swap(meters, from, to));
    setEnableds(swap(enableds, from, to));
  }

  const generatePresetButton = (beats: number[]) => (
    <button key={beats.join(",")} onClick={metersChangeHandler(beats)}>{ beats.join(",") }</button>
  );

  // シンセ設定
  useEffect(() => {
    // シンセサイザーを初期化
    const newSynth = new Tone.PolySynth();
    newSynth.toDestination();
    // 最大7つの音が鳴るのでlog_10(7)*2≒17(dB)下げる
    newSynth.volume.value = -17;
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

          if (notes.length > 0) {
            play(notes);
          }

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
                <input type="string" value={coerceToNumericOrEmpty(meters[i])} disabled={!enabled} className="denominator" onChange={meterChangeHandler(i)}></input>
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
      <div id="buttons-wrapper">
        <div id="preset-buttons">
          <h2>プリセット</h2>
          {
            beatPresets.map((presets, i) => (
              <div key={`preset-row-${i}`} className="beats-line">
                {
                  presets.map((preset: number[]) => (
                    generatePresetButton(preset)
                  ))
                }
              </div>
            ))
          }
          <button onClick={randomMetersChangeHandler(4, 8)}>重複なしランダム(4個、2~8)</button>
          <button onClick={randomMetersChangeHandler(4, 12)}>重複なしランダム(4個、2~12)</button>
          <button onClick={randomMetersChangeHandler(5, 12)}>重複なしランダム(5個、2~12)</button>
        </div>
        <div id="other-buttons">
          <h2>その他操作</h2>
          <div>
            <button onClick={upsideDownHandler}>上下を入れ替える</button>
          </div>
          <div>
            <button onClick={swapHandler(0, 1)}>1番目と2番目を入れ替える</button>
            <button onClick={swapHandler(1, 2)}>2番目と3番目を入れ替える</button>
            <button onClick={swapHandler(2, 3)}>3番目と4番目を入れ替える</button>
            <button onClick={swapHandler(3, 4)}>4番目と5番目を入れ替える</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
