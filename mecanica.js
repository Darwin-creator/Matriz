const stations = [
  {id:1,color:"#2475d8",title:"Construye tu matriz",short:"Filas, columnas y posiciones",icon:"🧩",topic:"¿Qué es una matriz?"},
  {id:2,color:"#36a34a",title:"Detectives de matrices",short:"Reconoce los tipos de matrices",icon:"🔎",topic:"Tipos de matrices"},
  {id:3,color:"#e5a918",title:"La batalla de matrices",short:"Suma, resta y escalares",icon:"⚔️",topic:"Operaciones"},
  {id:4,color:"#7c4dcc",title:"La fábrica de matrices",short:"Multiplicación de matrices",icon:"⚙️",topic:"Multiplicación"},
  {id:5,color:"#e34b4b",title:"El código secreto",short:"Sistemas y método de Gauss",icon:"🔐",topic:"Sistema de ecuaciones"}
];

const state = {
  score: Number(localStorage.getItem("matrix_score") || 0),
  completed: JSON.parse(localStorage.getItem("matrix_completed") || "[]"),
  stars: JSON.parse(localStorage.getItem("matrix_stars") || "{}"),
  stationScores: JSON.parse(localStorage.getItem("matrix_station_scores") || "{}"),
  sound: localStorage.getItem("matrix_sound") !== "off",
  station: 0, round: 0, correct: 0, roundScore: 0, streak: 0,
  timerId: null, timerDeadline: null, timeRemaining: 0, timerPaused: false,
  current: null, code: [],
  audioContext: null, musicMaster: null, musicTimer: null, musicStep: 0
};

const $ = id => document.getElementById(id);
const screens = ["homeScreen","mapScreen","gameScreen","resultScreen","finalScreen"];

function showScreen(id){
  // Navegación de pantalla centralizada: no usamos scroll suave aquí porque
  // puede competir con el scroll manual del usuario en escritorio.
  screens.forEach(s => $(s).classList.toggle("active", s===id));

  // Esperamos al siguiente frame para que el navegador calcule la nueva altura
  // del contenido antes de llevar la vista al inicio de la pantalla.
  requestAnimationFrame(() => {
    window.scrollTo({top:0, left:0, behavior:"auto"});
  });
}
function save(){
  localStorage.setItem("matrix_score",state.score);
  localStorage.setItem("matrix_completed",JSON.stringify(state.completed));
  localStorage.setItem("matrix_stars",JSON.stringify(state.stars));
  localStorage.setItem("matrix_station_scores",JSON.stringify(state.stationScores));
}
function updateScore(){
  $("scoreTop").textContent=state.score;
  $("mapScore").textContent=state.score;
  $("gameScore").textContent=state.score;
}
function getAudioContext(){
  if(state.audioContext) return state.audioContext;
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C) return null;
    state.audioContext=new C();
    return state.audioContext;
  }catch(e){ return null; }
}
function sound(type){
  if(!state.sound) return;
  try{
    const c=getAudioContext();
    if(!c) return;
    if(c.state==="suspended") c.resume();
    const o=c.createOscillator(), g=c.createGain();
    o.type=type==="good"?"triangle":"sine";
    o.frequency.value=type==="good"?650:type==="bad"?170:420;
    g.gain.setValueAtTime(.055,c.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.16);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime+.16);
  }catch(e){}
}
function playMusicNote(){
  if(!state.sound) return;
  try{
    const c=getAudioContext();
    if(!c) return;
    if(c.state==="suspended") c.resume();
    const melody=[261.63,329.63,392.00,493.88,392.00,329.63,293.66,349.23,440.00,523.25,440.00,349.23,261.63,329.63,392.00,440.00];
    const bass=[130.81,130.81,146.83,146.83,164.81,164.81,146.83,146.83];
    const now=c.currentTime;
    const note=melody[state.musicStep%melody.length];
    const bassNote=bass[state.musicStep%bass.length];
    const lead=c.createOscillator(), leadGain=c.createGain();
    lead.type="triangle"; lead.frequency.setValueAtTime(note,now);
    leadGain.gain.setValueAtTime(.0001,now); leadGain.gain.exponentialRampToValueAtTime(.026,now+.025); leadGain.gain.exponentialRampToValueAtTime(.0001,now+.24);
    lead.connect(leadGain); leadGain.connect(state.musicMaster||c.destination); lead.start(now); lead.stop(now+.26);
    if(state.musicStep%4===0){
      const bassOsc=c.createOscillator(), bassGain=c.createGain();
      bassOsc.type="sine"; bassOsc.frequency.setValueAtTime(bassNote,now);
      bassGain.gain.setValueAtTime(.0001,now); bassGain.gain.exponentialRampToValueAtTime(.018,now+.03); bassGain.gain.exponentialRampToValueAtTime(.0001,now+.48);
      bassOsc.connect(bassGain); bassGain.connect(state.musicMaster||c.destination); bassOsc.start(now); bassOsc.stop(now+.5);
    }
    state.musicStep++;
  }catch(e){}
}
function startMusic(){
  if(!state.sound || state.musicTimer) return;
  try{
    const c=getAudioContext();
    if(!c) return;
    if(c.state==="suspended") c.resume();
    if(!state.musicMaster){
      state.musicMaster=c.createGain();
      state.musicMaster.gain.value=.9;
      state.musicMaster.connect(c.destination);
    }
    playMusicNote();
    state.musicTimer=window.setInterval(playMusicNote,280);
  }catch(e){}
}
function stopMusic(){
  if(state.musicTimer!==null){
    clearInterval(state.musicTimer);
    state.musicTimer=null;
  }
}
function renderStations(target){
  $(target).innerHTML = stations.map((s,i)=>{
    const unlocked=i===0 || state.completed.includes(i);
    const done=state.completed.includes(i+1);
    const stars=state.stars[i+1]||0;
    return `<article class="station-card ${unlocked?"":"locked"}" style="--c:${s.color}" data-station="${i+1}">
      <span class="station-status">${done?"✅":unlocked?"▶":"🔒"}</span>
      <div class="station-number">${s.id}</div>
      <h3>${s.icon} ${s.title}</h3>
      <p>${s.short}</p>
      <div class="stars">${"★".repeat(stars)}${"☆".repeat(3-stars)}</div>
    </article>`;
  }).join("");
  $(target).querySelectorAll(".station-card").forEach(card=>{
    card.onclick=()=>{ const n=Number(card.dataset.station); if(n===1 || state.completed.includes(n-1)) startStation(n); };
  });
}
function renderHome(){
  updateScore();
}
function renderStationResults(){
  const target=$("stationResults");
  if(!target) return;
  target.innerHTML=stations.map(s=>{
    const stars=state.stars[s.id]||0;
    const stationScore=Number(state.stationScores[s.id]||0);
    const done=state.completed.includes(s.id);
    return `<div class="station-result-item ${done?"done":"empty"}" style="--c:${s.color}">
      <b>${s.icon} Estación ${s.id}</b>
      <div class="station-result-score">${stationScore} <small>/ 1000 pts</small></div>
      <div class="station-result-stars">${"★".repeat(stars)}${"☆".repeat(3-stars)}</div>
      <span class="station-result-status">${done?`${stars}/3 estrellas · completada`:"Aún no completada"}</span>
    </div>`;
  }).join("");
}
function renderMap(){
  renderStations("mapStations");
  renderStationResults();
  $("progressText").textContent=`${state.completed.length} / 5`;
  $("globalProgress").style.width=(state.completed.length/5*100)+"%";
  updateScore();
}

const challenges = {
1:[{"q":"¿Cuántas filas tiene esta matriz?","matrix":[[2,5,1],[4,3,7]],"opts":["1","2","3","6"],"ans":"2"},{"q":"¿Cuántas columnas tiene esta matriz?","matrix":[[4,8,2],[1,6,9]],"opts":["2","3","4","6"],"ans":"3"},{"q":"¿Cuál es el elemento a₂,₃?","matrix":[[2,5,1],[4,3,7]],"opts":["1","3","7","5"],"ans":"7"},{"q":"¿En qué posición está el número 9?","matrix":[[1,2,3],[4,5,6],[7,8,9]],"opts":["(1,3)","(2,2)","(3,3)","(3,2)"],"ans":"(3,3)"},{"q":"¿Qué dimensión tiene esta matriz?","matrix":[[1,2],[3,4],[5,6]],"opts":["2×2","2×3","3×2","3×3"],"ans":"3×2"},{"q":"¿Cuál es el elemento a₁,₂?","matrix":[[8,4,6],[3,7,2]],"opts":["8","4","6","7"],"ans":"4"},{"q":"¿Cuál es el elemento a₂,₁?","matrix":[[9,2,5],[6,1,8]],"opts":["9","2","6","8"],"ans":"6"},{"q":"¿Cuántos elementos tiene una matriz 3×2?","visual":[[1,2],[3,4],[5,6]],"opts":["5","6","8","9"],"ans":"6"},{"q":"¿Qué dimensión tiene esta matriz?","matrix":[[7,1,4,2],[3,8,5,9]],"opts":["2×4","4×2","2×3","4×4"],"ans":"2×4"},{"q":"¿En qué posición está el número 12?","matrix":[[4,6,9],[2,8,12],[1,3,5]],"opts":["(1,3)","(2,2)","(2,3)","(3,2)"],"ans":"(2,3)"}],
2:[{"q":"Identifica la matriz FILA.","opts":["[ 1  2  3 ]","[ 1 ] [ 2 ] [ 3 ]","[1 0] [0 1]","[0 0] [0 0]"],"ans":"[ 1  2  3 ]"},{"q":"Identifica la matriz COLUMNA.","opts":["[ 1  2  3 ]","[ 1 ] [ 2 ] [ 3 ]","[1 0] [0 1]","[0 0] [0 0]"],"ans":"[ 1 ] [ 2 ] [ 3 ]"},{"q":"¿Cuál es una matriz IDENTIDAD?","opts":["[1 0] [0 1]","[1 1] [1 1]","[0 0] [0 0]","[1 2] [3 4]"],"ans":"[1 0] [0 1]"},{"q":"¿Cuál es una matriz CERO?","opts":["[1 0] [0 1]","[0 0] [0 0]","[1 2] [3 4]","[1 0 0]"],"ans":"[0 0] [0 0]"},{"q":"¿Cuál es RECTANGULAR?","opts":["[1 2] [3 4]","[1 2 3] [4 5 6]","[1 0] [0 1]","[0 0] [0 0]"],"ans":"[1 2 3] [4 5 6]"},{"q":"¿Cuál es una matriz CUADRADA?","opts":["[1 2 3] [4 5 6]","[1 2] [3 4]","[1] [2] [3]","[1 2 3]"],"ans":"[1 2] [3 4]"},{"q":"¿Cuál es una matriz FILA?","opts":["[4 7 2 9]","[4] [7] [2] [9]","[1 0] [0 1]","[0 0] [0 0]"],"ans":"[4 7 2 9]"},{"q":"¿Cuál es una matriz COLUMNA?","opts":["[2 5 8]","[2] [5] [8]","[1 2] [3 4]","[0 0] [0 0]"],"ans":"[2] [5] [8]"},{"q":"¿Cuál es una matriz IDENTIDAD de 3×3?","opts":["[1 0 0] [0 1 0] [0 0 1]","[1 1 1] [1 1 1] [1 1 1]","[0 0 0] [0 0 0] [0 0 0]","[1 2 3] [4 5 6] [7 8 9]"],"ans":"[1 0 0] [0 1 0] [0 0 1]"},{"q":"¿Cuál es una matriz CERO de 2×3?","opts":["[0 0 0] [0 0 0]","[1 0 0] [0 1 0]","[0 0] [0 0]","[1 1 1] [1 1 1]"],"ans":"[0 0 0] [0 0 0]"}],
3:[{"q":"Calcula A + B.","a":[[1,2],[3,4]],"b":[[5,6],[7,8]],"opts":["[6 8] [10 12]","[-4 -4] [-4 -4]","[5 12] [21 32]","[7 9] [11 13]"],"ans":"[6 8] [10 12]"},{"q":"Calcula A − B.","a":[[9,7],[5,3]],"b":[[4,2],[1,1]],"opts":["[5 5] [4 2]","[13 9] [6 4]","[36 14] [5 3]","[6 6] [5 3]"],"ans":"[5 5] [4 2]"},{"q":"Calcula A + B.","a":[[2,4],[1,3]],"b":[[6,1],[5,2]],"opts":["[8 5] [6 5]","[-4 3] [-4 1]","[12 4] [5 6]","[9 6] [7 6]"],"ans":"[8 5] [6 5]"},{"q":"Calcula A − B.","a":[[10,8],[6,4]],"b":[[3,2],[1,1]],"opts":["[7 6] [5 3]","[13 10] [7 5]","[30 16] [6 4]","[8 7] [6 4]"],"ans":"[7 6] [5 3]"},{"q":"Calcula A + B.","a":[[5,0],[2,7]],"b":[[1,4],[6,3]],"opts":["[6 4] [8 10]","[4 -4] [-4 4]","[5 0] [12 21]","[7 5] [9 11]"],"ans":"[6 4] [8 10]"},{"q":"Calcula A − B.","a":[[8,9],[7,5]],"b":[[2,4],[3,1]],"opts":["[6 5] [4 4]","[10 13] [10 6]","[16 36] [21 5]","[7 6] [5 5]"],"ans":"[6 5] [4 4]"},{"q":"Calcula 3A.","a":[[2,1],[4,3]],"opts":["[6 3] [12 9]","[5 4] [7 6]","[8 4] [16 12]","[2 1] [4 3]"],"ans":"[6 3] [12 9]"},{"q":"Calcula 2A.","a":[[5,3],[2,4]],"opts":["[10 6] [4 8]","[7 5] [4 6]","[15 9] [6 12]","[5 3] [2 4]"],"ans":"[10 6] [4 8]"},{"q":"Calcula 4A.","a":[[1,2],[3,5]],"opts":["[4 8] [12 20]","[5 6] [7 9]","[5 10] [15 25]","[1 2] [3 5]"],"ans":"[4 8] [12 20]"},{"q":"Calcula 5A.","a":[[2,0],[1,3]],"opts":["[10 0] [5 15]","[7 5] [6 8]","[12 0] [6 18]","[2 0] [1 3]"],"ans":"[10 0] [5 15]"}],
4:[{"q":"Calcula A × B.","a":[[1,2],[3,4]],"b":[[5,6],[7,8]],"opts":["[19 22] [43 50]","[6 8] [10 12]","[5 6] [15 18]","[23 31] [34 46]"],"ans":"[19 22] [43 50]"},{"q":"Calcula A × B.","a":[[2,1],[0,3]],"b":[[4,2],[5,1]],"opts":["[13 5] [15 3]","[6 3] [5 4]","[8 4] [0 0]","[8 10] [10 8]"],"ans":"[13 5] [15 3]"},{"q":"Calcula A × B.","a":[[1,0],[2,3]],"b":[[4,5],[1,2]],"opts":["[4 5] [11 16]","[5 5] [3 5]","[4 5] [8 10]","[14 5] [15 6]"],"ans":"[4 5] [11 16]"},{"q":"Calcula A × B.","a":[[2,3],[1,4]],"b":[[1,2],[3,5]],"opts":["[11 19] [13 22]","[3 5] [4 9]","[2 4] [1 2]","[4 11] [11 29]"],"ans":"[11 19] [13 22]"},{"q":"Calcula A × B.","a":[[3,1],[2,2]],"b":[[2,4],[1,3]],"opts":["[7 15] [6 14]","[5 5] [3 5]","[6 12] [4 8]","[14 9] [10 7]"],"ans":"[7 15] [6 14]"},{"q":"Calcula A × B.","a":[[1,4],[2,1]],"b":[[3,2],[5,1]],"opts":["[23 6] [11 5]","[4 6] [7 2]","[3 2] [6 4]","[7 7] [14 21]"],"ans":"[23 6] [11 5]"},{"q":"Si A es 2×3 y B es 3×2, ¿qué dimensión tendrá A×B?","opts":["2×2","3×3","2×3","3×2"],"ans":"2×2"},{"q":"Si A es 3×2 y B es 2×4, ¿qué dimensión tendrá A×B?","opts":["3×4","2×2","4×3","3×2"],"ans":"3×4"},{"q":"¿Qué condición se necesita para multiplicar A×B?","opts":["Columnas de A = filas de B","Filas de A = filas de B","Columnas de A = columnas de B","Siempre se puede"],"ans":"Columnas de A = filas de B"},{"q":"Si A es 2×2 y B es 2×3, ¿qué dimensión tendrá A×B?","opts":["2×3","3×2","2×2","3×3"],"ans":"2×3"}],
5:[{"q":"Resuelve: x + y = 5; 2x + y = 7.","opts":["x=2, y=3","x=3, y=2","x=1, y=4","x=4, y=1"],"ans":"x=2, y=3"},{"q":"Resuelve: x + y = 8; x − y = 2.","opts":["x=5, y=3","x=4, y=4","x=3, y=5","x=6, y=2"],"ans":"x=5, y=3"},{"q":"Resuelve: 2x + y = 9; x + y = 6.","opts":["x=3, y=3","x=2, y=4","x=4, y=2","x=5, y=1"],"ans":"x=3, y=3"},{"q":"Resuelve: x + 2y = 8; x − y = 2.","opts":["x=4, y=2","x=6, y=1","x=3, y=5","x=5, y=3"],"ans":"x=4, y=2"},{"q":"Resuelve: 3x + y = 10; x + y = 6.","opts":["x=2, y=4","x=3, y=3","x=1, y=5","x=4, y=2"],"ans":"x=2, y=4"},{"q":"Resuelve: 2x + 3y = 12; x + y = 5.","opts":["x=3, y=2","x=2, y=3","x=4, y=1","x=1, y=4"],"ans":"x=3, y=2"},{"q":"Resuelve: x + 2y = 7; 2x − y = 4.","opts":["x=3, y=2","x=2, y=3","x=4, y=1","x=1, y=3"],"ans":"x=3, y=2"},{"q":"Resuelve: 3x + 2y = 16; x + y = 6.","opts":["x=4, y=2","x=2, y=4","x=3, y=3","x=5, y=1"],"ans":"x=4, y=2"},{"q":"Resuelve: 2x + y = 11; x + 2y = 10.","opts":["x=4, y=3","x=3, y=4","x=5, y=1","x=2, y=5"],"ans":"x=4, y=3"},{"q":"Resuelve: x + y = 9; 3x + y = 13.","opts":["x=2, y=7","x=3, y=6","x=4, y=5","x=1, y=8"],"ans":"x=2, y=7"}]
};

function matrixHTML(m){
  if(!m) return "";
  return `<div class="matrix" style="--cols:${m[0].length}">${m.flat().map(x=>`<span>${x}</span>`).join("")}</div>`;
}
function answerVisual(value){
  const raw=String(value).trim();
  if(!raw.includes("[")) return `<span class="answer-text">${raw}</span>`;

  const rows=[...raw.matchAll(/\[([^\]]*)\]/g)].map(m=>m[1].trim().split(/\s+/).filter(Boolean));
  const cols=Math.max(...rows.map(r=>r.length));
  const cells=[];
  rows.forEach(r=>r.forEach(x=>cells.push(`<span>${x}</span>`)));
  return `<span class="answer-matrix" style="--cols:${cols}">${cells.join("")}</span>`;
}

function shuffleArray(items){
  const arr=[...items];
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function arrangeOptions(options, answer){
  // Distribuye la respuesta correcta entre A, B, C y D de forma equilibrada.
  // Así no se generan estaciones donde casi todo sea la opción A.
  const correctIndex=(state.round + state.station - 1) % options.length;
  const others=shuffleArray(options.filter(option=>option!==answer));
  const arranged=[];
  let otherIndex=0;
  for(let i=0;i<options.length;i++){
    arranged.push(i===correctIndex ? answer : others[otherIndex++]);
  }
  return arranged;
}

function challengeHTML(c){
  let html="";
  if(c.visual) html+=`<div class="question-visual" aria-label="Matriz de referencia">${matrixHTML(c.visual)}</div>`;
  html+=`<div class="question">${c.q}</div>`;
  if(c.matrix) html+=matrixHTML(c.matrix);
  if(c.a){
    html+=`<div class="matrix-operation">${matrixHTML(c.a)}
      <b class="operator">${c.q.includes("×") ? "×" : c.q.includes("−") ? "−" : "+"}</b>
      ${c.b ? matrixHTML(c.b) : ""}</div>`;
  }
  if(c.opts){
    const shuffled=arrangeOptions(c.opts,c.ans);
    html+=`<div class="options">${shuffled.map((o,i)=>`<button type="button" class="option-btn" data-answer="${encodeURIComponent(o)}" aria-label="Opción ${i+1}">${answerVisual(o)}</button>`).join("")}</div>`;
  }
  return html;
}


function resetStations(){
  const confirmed=window.confirm("¿Quieres reiniciar las 5 estaciones? Se borrará el puntaje total, las estrellas y el progreso de este jugador.");
  if(!confirmed) return;
  stopTimer();
  state.score=0;
  state.completed=[];
  state.stars={};
  state.stationScores={};
  state.station=0; state.round=0; state.correct=0; state.roundScore=0; state.streak=0;
  state.timeRemaining=0; state.timerPaused=false; state.current=null; state.code=[];
  save();
  updateScore();
  renderMap();
  showScreen("mapScreen");
  sound("neutral");
}

function startStation(n){
  if(n>1 && !state.completed.includes(n-1)) return;
  stopTimer();
  state.station=n; state.round=0; state.correct=0; state.roundScore=0; state.streak=0; state.timerPaused=false;
  $("gameStationName").textContent=`${stations[n-1].icon} ${stations[n-1].title}`;
  document.documentElement.style.setProperty("--game-color",stations[n-1].color);
  showScreen("gameScreen");
  loadChallenge();
}
function loadChallenge(){
  const list=challenges[state.station], c=list[state.round];
  state.current=c;
  $("levelTag").textContent=`RETO ${state.round+1} / ${list.length}`;
  $("challengeTopic").textContent=stations[state.station-1].topic;
  $("roundProgress").style.width=((state.round)/list.length*100)+"%";
  $("challengeContent").innerHTML=challengeHTML(c);
  $("feedback").className="feedback"; $("feedback").textContent="";
  $("streak").textContent=state.streak;
  startTimer();
  $("challengeContent").querySelectorAll(".option-btn").forEach(btn=>btn.onclick=()=>checkAnswer(decodeURIComponent(btn.dataset.answer),btn));
}
function startTimer(){
  stopTimer();
  state.timerPaused=false;

  const timeByStation={1:20,2:30,3:45,4:60,5:75};
  state.timeRemaining=timeByStation[state.station]||30;
  state.timerDeadline=Date.now()+state.timeRemaining*1000;
  updateTimerDisplay();
  updatePauseButton();
  setAnswerButtonsDisabled(false);

  // El contador se calcula a partir de una hora límite real.
  // Así no depende de que setInterval se ejecute exactamente cada segundo.
  state.timerId=window.setInterval(()=>{
    if(state.timerPaused || state.timerDeadline===null) return;
    const remaining=Math.max(0,state.timerDeadline-Date.now());
    state.timeRemaining=Math.ceil(remaining/1000);
    updateTimerDisplay();
    if(remaining<=0){
      stopTimer();
      state.timeRemaining=0;
      updateTimerDisplay();
      checkAnswer("__TIME__",null,true);
    }
  },100);
}

function stopTimer(){
  if(state.timerId!==null){
    clearInterval(state.timerId);
    state.timerId=null;
  }
  state.timerDeadline=null;
}

function updateTimerDisplay(){
  const total=Math.max(0,Number(state.timeRemaining)||0);
  const minutes=Math.floor(total/60);
  const seconds=total%60;
  $("timer").textContent=`${minutes}:${String(seconds).padStart(2,"0")}`;
  $("timer").parentElement.classList.toggle("timer-warning",total<=30 && !state.timerPaused);
}

function setAnswerButtonsDisabled(disabled){
  document.querySelectorAll("#challengeContent .option-btn").forEach(btn=>{btn.disabled=disabled;});
}

function updatePauseButton(){
  const btn=$("timerToggle");
  if(!btn) return;
  btn.textContent=state.timerPaused?"▶":"⏸";
  btn.title=state.timerPaused?"Continuar tiempo":"Pausar tiempo";
  btn.setAttribute("aria-label",state.timerPaused?"Continuar tiempo":"Pausar tiempo");
  btn.classList.toggle("paused",state.timerPaused);
}

function togglePause(){
  if(!state.current || state.timeRemaining<=0 || (!state.timerPaused && state.timerId===null)) return;
  if(state.timerPaused){
    state.timerPaused=false;
    state.timerDeadline=Date.now()+state.timeRemaining*1000;
    setAnswerButtonsDisabled(false);
    $("challengeContent").classList.remove("game-paused");
  }else{
    if(state.timerDeadline!==null){
      state.timeRemaining=Math.max(0,Math.ceil((state.timerDeadline-Date.now())/1000));
    }
    state.timerPaused=true;
    setAnswerButtonsDisabled(true);
    $("challengeContent").classList.add("game-paused");
  }
  updateTimerDisplay();
  updatePauseButton();
}

function checkAnswer(answer,btn,timeout=false){
  if(state.timerPaused && !timeout) return;
  stopTimer();
  state.timerPaused=false;
  updatePauseButton();
  setAnswerButtonsDisabled(true);
  $("challengeContent").classList.remove("game-paused");
  const correct=answer===state.current.ans;
  if(btn){document.querySelectorAll(".option-btn").forEach(b=>b.disabled=true);}
  const fb=$("feedback");
  if(correct){
    state.correct++; state.streak++;
    const pts=100;
    state.roundScore+=pts;
    state.score=Object.values(state.stationScores).reduce((sum,value)=>sum+Number(value||0),0)+state.roundScore;
    save(); updateScore(); sound("good");
    if(btn) btn.classList.add("correct");
    fb.className="feedback good"; fb.textContent=`✓ ¡Correcto! +${pts} puntos`;
  }else{
    state.streak=0; sound("bad");
    if(btn) btn.classList.add("wrong");
    fb.className="feedback bad"; fb.textContent=timeout?`⏱ Se acabó el tiempo. Era: ${state.current.ans}`:`✗ Casi. La respuesta era: ${state.current.ans}`;
  }
  $("streak").textContent=state.streak;
  setTimeout(()=>{
    state.round++;
    if(state.round<challenges[state.station].length) loadChallenge(); else finishStation();
  },1100);
}
function finishStation(){
  const total=challenges[state.station].length, ratio=state.correct/total;
  const stars=ratio===1?3:ratio>=.8?2:ratio>=.6?1:0;
  const previous=state.stars[state.station]||0;
  state.stars[state.station]=Math.max(previous,stars);
  const previousScore=Number(state.stationScores[state.station]||0);
  state.stationScores[state.station]=Math.max(previousScore,state.roundScore);
  state.score=Object.values(state.stationScores).reduce((sum,value)=>sum+Number(value||0),0);
  if(!state.completed.includes(state.station)) state.completed.push(state.station);
  save(); stopTimer();
  $("resultPoints").textContent=state.roundScore;
  $("resultCorrect").textContent=`${state.correct}/${total}`;
  $("resultStars").textContent="★".repeat(stars)+"☆".repeat(3-stars);
  $("resultTitle").textContent=stars===3?"¡Dominaste la estación!":stars>=2?"¡Muy buen trabajo!":"¡Estación superada!";
  $("resultMessage").textContent=stars===3?"Tu precisión fue perfecta. Sigue así para desbloquear el código secreto.":"La estación está completada. Puedes repetirla para mejorar tus estrellas.";
  $("nextBtn").textContent=state.station<5?"SIGUIENTE ESTACIÓN →":"IR AL CÓDIGO SECRETO 🔐";
  showScreen("resultScreen"); renderHome(); renderMap();
}
function buildFinal(){
  $("finalScore").textContent=state.score;
  const vals=[1,2,3,4,5].map(n=>state.stars[n]||0);
  // Código variable según desempeño: siempre deducible por completar las estaciones.
  state.code=vals.map((s,i)=>(i+1)+s);
  $("secretCode").textContent=state.code.map(()=>"_").join(" ");
  $("codeInputs").innerHTML=state.code.map((_,i)=>`<input maxlength="1" inputmode="numeric" aria-label="Dígito ${i+1}">`).join("");
  const inputs=[...$("codeInputs").querySelectorAll("input")];
  inputs.forEach((inp,i)=>{inp.oninput=()=>{if(inp.value && inputs[i+1]) inputs[i+1].focus();}});
}
function unlock(){
  const entered=[...$("codeInputs").querySelectorAll("input")].map(x=>x.value).join("");
  const expected=state.code.join("");
  const fb=$("finalFeedback");
  if(entered===expected){
    fb.className="feedback good"; fb.textContent=`🔓 ¡CÓDIGO DESBLOQUEADO! ${expected} · ¡Misión completada!`;
    sound("good");
    $("secretCode").textContent=state.code.join(" ");
    $("unlockBtn").disabled=true;
  }else{
    fb.className="feedback bad"; fb.textContent="🔒 Código incorrecto. Revisa tus resultados y vuelve a intentarlo.";
    $("finalScreen").querySelector(".final-card").classList.add("shake");
    setTimeout(()=>$("finalScreen").querySelector(".final-card").classList.remove("shake"),400);
    sound("bad");
  }
}

$("startBtn").onclick=()=>{startMusic();renderMap();showScreen("mapScreen")};
$("howBtn").onclick=()=>openHelp();
$("helpBtn").onclick=()=>openHelp();
$("modalClose").onclick=()=>$("modal").classList.add("hidden");
$("mapBack").onclick=()=>{renderHome();showScreen("homeScreen")};
$("gameBack").onclick=()=>{stopTimer();renderMap();showScreen("mapScreen")};
$("resultMapBtn").onclick=()=>{renderMap();showScreen("mapScreen")};
$("retryBtn").onclick=()=>startStation(state.station);
$("nextBtn").onclick=()=>{
  if(state.station<5){startStation(state.station+1)}
  else {buildFinal();showScreen("finalScreen")}
};
$("unlockBtn").onclick=unlock;
$("timerToggle").onclick=togglePause;
$("resetStationsBtn").onclick=resetStations;
$("homeBtn").onclick=()=>{stopTimer();renderHome();showScreen("homeScreen")};
$("soundBtn").onclick=()=>{
  state.sound=!state.sound; localStorage.setItem("matrix_sound",state.sound?"on":"off");
  $("soundBtn").textContent=state.sound?"🔊":"🔇";
  if(state.sound) startMusic(); else stopMusic();
};
function openHelp(){
  $("modalContent").innerHTML=`<h2>🎮 ¿Cómo jugar?</h2>
  <ul>
    <li>Completa las <b>5 estaciones</b> en orden.</li>
    <li>Cada reto correcto da exactamente <b>100 puntos</b>.</li>
    <li>Consigue ⭐⭐⭐ para dominar una estación.</li>
    <li>Al terminar las cinco estaciones se genera tu <b>código secreto</b>.</li>
    <li>Tu progreso se guarda automáticamente en este navegador.</li>
  </ul>
  <p><b>Consejo:</b> lee primero las filas y columnas antes de responder. ¡La velocidad ayuda, pero la precisión manda!</p>`;
  $("modal").classList.remove("hidden");
}
renderHome();
$("soundBtn").textContent=state.sound?"🔊":"🔇";
