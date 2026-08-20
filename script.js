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
  attempts: JSON.parse(localStorage.getItem("matrix_attempts") || "{}"),
  sound: localStorage.getItem("matrix_sound") !== "off",
  station: 0, round: 0, correct: 0, roundScore: 0, streak: 0,
  timerId: null, timerDeadline: null, timeRemaining: 0, timerPaused: false,
  current: null, code: [], questionOrder: [], lastQuestionOrders: {}, optionHistory: {},
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
  localStorage.setItem("matrix_attempts",JSON.stringify(state.attempts));
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
    o.type=type==="good"?"triangle":type==="wrong"?"sawtooth":"sine";
    o.frequency.value=type==="good"?650:type==="wrong"?120:type==="bad"?170:420;
    g.gain.setValueAtTime(.055,c.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.16);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime+.16);
  }catch(e){}
}
function scheduleMusicNote(when){
  if(!state.sound) return;
  try{
    const c=getAudioContext();
    if(!c) return;
    const melody=[261.63,329.63,392.00,493.88,392.00,329.63,293.66,349.23,440.00,523.25,440.00,349.23,261.63,329.63,392.00,440.00];
    const bass=[130.81,130.81,146.83,146.83,164.81,164.81,146.83,146.83];
    const note=melody[state.musicStep%melody.length];
    const bassNote=bass[state.musicStep%bass.length];

    const lead=c.createOscillator(), leadGain=c.createGain();
    lead.type="triangle";
    lead.frequency.setValueAtTime(note,when);
    leadGain.gain.setValueAtTime(.0001,when);
    leadGain.gain.exponentialRampToValueAtTime(.026,when+.025);
    leadGain.gain.exponentialRampToValueAtTime(.0001,when+.24);
    lead.connect(leadGain); leadGain.connect(state.musicMaster||c.destination);
    lead.start(when); lead.stop(when+.26);

    if(state.musicStep%4===0){
      const bassOsc=c.createOscillator(), bassGain=c.createGain();
      bassOsc.type="sine";
      bassOsc.frequency.setValueAtTime(bassNote,when);
      bassGain.gain.setValueAtTime(.0001,when);
      bassGain.gain.exponentialRampToValueAtTime(.018,when+.03);
      bassGain.gain.exponentialRampToValueAtTime(.0001,when+.48);
      bassOsc.connect(bassGain); bassGain.connect(state.musicMaster||c.destination);
      bassOsc.start(when); bassOsc.stop(when+.5);
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
    // Programamos las notas por adelantado. Así un pequeño retraso del
    // navegador no produce cortes ni espacios audibles entre notas.
    state.nextMusicTime=Math.max(c.currentTime+.03,state.nextMusicTime||0);
    const scheduleAhead=.12;
    const interval=.28;
    const scheduler=()=>{
      if(!state.sound || !state.audioContext) return;
      const now=c.currentTime;
      while(state.nextMusicTime < now + scheduleAhead){
        scheduleMusicNote(state.nextMusicTime);
        state.nextMusicTime += interval;
      }
    };
    scheduler();
    state.musicTimer=window.setInterval(scheduler,50);
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
3:[{"q":"Calcula A + B.","a":[[1,2],[3,4]],"b":[[5,6],[7,8]],"opts":["[6 8] [10 12]","[-4 -4] [-4 -4]","[5 12] [21 32]","[6 9] [11 13]"],"ans":"[6 8] [10 12]"},{"q":"Calcula A − B.","a":[[9,7],[5,3]],"b":[[4,2],[1,1]],"opts":["[5 5] [4 2]","[13 9] [6 4]","[36 14] [5 3]","[5 6] [5 3]"],"ans":"[5 5] [4 2]"},{"q":"Calcula A + B.","a":[[2,4],[1,3]],"b":[[6,1],[5,2]],"opts":["[8 5] [6 5]","[-4 3] [-4 1]","[12 4] [5 6]","[8 6] [7 6]"],"ans":"[8 5] [6 5]"},{"q":"Calcula A − B.","a":[[10,8],[6,4]],"b":[[3,2],[1,1]],"opts":["[7 6] [5 3]","[13 10] [7 5]","[30 16] [6 4]","[7 7] [6 4]"],"ans":"[7 6] [5 3]"},{"q":"Calcula A + B.","a":[[5,0],[2,7]],"b":[[1,4],[6,3]],"opts":["[6 4] [8 10]","[4 -4] [-4 4]","[5 0] [12 21]","[6 5] [9 11]"],"ans":"[6 4] [8 10]"},{"q":"Calcula A − B.","a":[[8,9],[7,5]],"b":[[2,4],[3,1]],"opts":["[6 5] [4 4]","[10 13] [10 6]","[16 36] [21 5]","[6 6] [5 5]"],"ans":"[6 5] [4 4]"},{"q":"Calcula 3A.","a":[[2,1],[4,3]],"opts":["[6 3] [12 9]","[5 4] [7 6]","[8 4] [16 12]","[6 2] [10 8]"],"ans":"[6 3] [12 9]"},{"q":"Calcula 2A.","a":[[5,3],[2,4]],"opts":["[10 6] [4 8]","[7 5] [4 6]","[15 9] [6 12]","[10 3] [2 4]"],"ans":"[10 6] [4 8]"},{"q":"Calcula 4A.","a":[[1,2],[3,5]],"opts":["[4 8] [12 20]","[10 5] [6 12]","[4 10] [12 20]","[1 2] [3 5]"],"ans":"[4 8] [12 20]"},{"q":"Calcula 5A.","a":[[2,0],[1,3]],"opts":["[10 0] [5 15]","[7 5] [6 8]","[10 5] [6 18]","[2 0] [1 3]"],"ans":"[10 0] [5 15]"}],
4:[
{"q":"Calcula A × B.","a":[[1,2],[3,4]],"b":[[5,6],[7,8]],"opts":["[19 22] [43 50]","[6 8] [10 12]","[5 6] [15 18]","[19 31] [34 46]"],"ans":"[19 22] [43 50]"},
{"q":"Calcula A × B.","a":[[2,1],[0,3]],"b":[[4,2],[5,1]],"opts":["[13 5] [15 3]","[6 3] [5 4]","[8 4] [0 0]","[13 10] [10 8]"],"ans":"[13 5] [15 3]"},
{"q":"Calcula la transpuesta de A.","type":"transpose","a":[[1,2],[3,4]],"opts":["[1 3] [2 4]","[1 2] [3 4]","[2 1] [4 3]","[3 4] [1 2]"],"ans":"[1 3] [2 4]"},
{"q":"Calcula la transpuesta de A.","type":"transpose","a":[[1,2,3],[4,5,6],[7,8,9]],"opts":["[1 4 7] [2 5 8] [3 6 9]","[1 2 3] [4 5 6] [7 8 9]","[3 6 9] [2 5 8] [1 4 7]","[7 4 1] [8 5 2] [9 6 3]"],"ans":"[1 4 7] [2 5 8] [3 6 9]"},
{"q":"Calcula la transpuesta de A.","type":"transpose","a":[[2,5],[1,4]],"opts":["[2 1] [5 4]","[2 5] [1 4]","[5 4] [2 1]","[1 2] [4 5]"],"ans":"[2 1] [5 4]"},
{"q":"Calcula la transpuesta de A.","type":"transpose","a":[[2,0,1],[3,4,5],[6,7,8]],"opts":["[2 3 6] [0 4 7] [1 5 8]","[2 0 1] [3 4 5] [6 7 8]","[8 5 1] [7 4 0] [6 3 2]","[6 3 2] [7 4 0] [8 5 1]"],"ans":"[2 3 6] [0 4 7] [1 5 8]"},
{"q":"Calcula la matriz adjunta de A.","type":"adjugate","a":[[2,3],[1,4]],"opts":["[4 -3] [-1 2]","[2 -3] [-1 4]","[4 3] [1 2]","[1 -3] [-2 4]"],"ans":"[4 -3] [-1 2]"},
{"q":"Calcula la matriz adjunta de A.","type":"adjugate","a":[[5,2],[3,1]],"opts":["[1 -2] [-3 5]","[5 -2] [-3 1]","[1 2] [3 5]","[3 -2] [-1 5]"],"ans":"[1 -2] [-3 5]"},
{"q":"¿Qué condición se necesita para multiplicar A×B?","opts":["Columnas de A = filas de B","Filas de A = filas de B","Columnas de A = columnas de B","Siempre se puede"],"ans":"Columnas de A = filas de B"},
{"q":"Al calcular un elemento de A×B, ¿qué se multiplica entre sí?","opts":["Una fila de A por una columna de B","Una columna de A por una fila de B","Solo los elementos de la diagonal","Toda A por toda B directamente"],"ans":"Una fila de A por una columna de B"}
],
5:[{"q":"Resuelve el sistema de ecuaciones: x + y = 5; 2x - y = 4.","opts":["x=3, y=2","x=2, y=3","x=4, y=1","x=1, y=4"],"ans":"x=3, y=2"}]
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

function arrangeOptions(options, answer, questionKey){
  // En cada aparición se mezclan los distractores y se evita repetir,
  // cuando sea posible, la posición anterior de la respuesta correcta.
  // Así la respuesta no queda memorizable por posición.
  const previous=state.optionHistory[questionKey];
  let shuffled=shuffleArray(options);

  if(shuffled.length>1 && previous){
    const previousAnswerIndex=previous.indexOf(answer);
    let tries=0;
    while(shuffled.indexOf(answer)===previousAnswerIndex && tries<20){
      shuffled=shuffleArray(options);
      tries++;
    }
    if(shuffled.indexOf(answer)===previousAnswerIndex){
      const answerIndex=shuffled.indexOf(answer);
      const swapIndex=(answerIndex+1)%shuffled.length;
      [shuffled[answerIndex],shuffled[swapIndex]]=[shuffled[swapIndex],shuffled[answerIndex]];
    }
  }

  state.optionHistory[questionKey]=[...shuffled];
  return shuffled;
}

function systemHTML(q){
  const parts=String(q).split(";").map(x=>x.trim()).filter(Boolean);
  if(parts.length!==2) return "";
  return `<div class="equation-system" aria-label="Sistema de ecuaciones 2 por 2">
    <div class="equation-brace">{</div>
    <div class="equations"><div>${parts[0]}</div><div>${parts[1]}</div></div>
  </div>`;
}

function scalarHTML(q,m){
  const match=String(q).match(/Calcula\s+(-?\d+)A/i);
  if(!match || !m) return "";
  return `<div class="matrix-scalar-operation" aria-label="Multiplica toda la matriz por ${match[1]}">
    <span class="scalar-number">${match[1]}</span>
    <b class="operator">×</b>
    <span aria-hidden="true">[</span>${matrixHTML(m)}<span aria-hidden="true">]</span>
  </div>
  <div class="scalar-help">Multiplica <b>cada número de la matriz</b> por ${match[1]}.</div>`;
}


function parseMatrixAnswer(value){
  const rows = String(value).match(/\[([^\]]+)\]/g);
  if(!rows) return null;
  return rows.map(row => row.replace(/[\[\]]/g,"").trim().split(/\s+/).map(Number));
}

function matrixAnswerString(m){
  return m.map(row=>`[${row.join(" ")}]`).join(" ");
}

function matrixMultiply(a,b){
  if(!a || !b || !a.length || !b.length || a[0].length!==b.length) return null;
  return a.map(row=>b[0].map((_,j)=>row.reduce((sum,val,k)=>sum+val*b[k][j],0)));
}
function matrixAdd(a,b){
  if(!a || !b || a.length!==b.length || a[0].length!==b[0].length) return null;
  return a.map((row,i)=>row.map((v,j)=>v+b[i][j]));
}
function matrixElementwise(a,b){
  if(!a || !b || a.length!==b.length || a[0].length!==b[0].length) return null;
  return a.map((row,i)=>row.map((v,j)=>v*b[i][j]));
}
function matrixTranspose(m){
  return m[0].map((_,j)=>m.map(row=>row[j]));
}
function buildStation4MatrixDistractors(c){
  const answer=String(c.ans);
  const out=[];
  const used=new Set([answer]);

  const pushMatrix=(m)=>{
    if(!m) return;
    const s=matrixAnswerString(m);
    if(!used.has(s)){ used.add(s); out.push(s); }
  };

  if(c.type==='adjugate' && c.a){
    const m=c.a;
    // Distractores plausibles para la adjunta 2×2. Varias opciones
    // conservan parte de los valores correctos para evitar pistas por un
    // solo número.
    pushMatrix([[m[1][1],-m[0][1]],[-m[1][0],m[0][0]]]);
    pushMatrix([[m[1][1],m[0][1]],[m[1][0],m[0][0]]]);
    pushMatrix([[m[0][0],-m[0][1]],[-m[1][0],m[1][1]]]);
    pushMatrix(matrixTranspose(m));
    if(out.length<3){
      const variants=buildMatrixDistractors(answer)||[];
      for(const x of variants){ if(!used.has(x)){used.add(x);out.push(x);} if(out.length===3) break; }
    }
    return out.slice(0,3);
  }

  if(c.type==='transpose' && c.a){
    const original=c.a;
    const correct=matrixTranspose(original);
    // En las transpuestas 2×2 y 3×3 se mezclan variantes que se parecen
    // visualmente a la respuesta para que no baste mirar el primer valor.
    pushMatrix(original);
    pushMatrix(original.map(row=>[...row].reverse()));
    pushMatrix([...original].reverse().map(row=>[...row]));
    pushMatrix(correct.map(row=>[...row].reverse()));
    pushMatrix(correct);
    if(out.length<3){
      const variants=buildMatrixDistractors(answer)||[];
      for(const x of variants){ if(!used.has(x)){used.add(x);out.push(x);} if(out.length===3) break; }
    }
    return out.slice(0,3);
  }

  if(c.a && c.b){
    const normal=matrixMultiply(c.a,c.b);
    if(normal){
      // Tres distractores comparten el primer elemento correcto y cambian
      // otros elementos. Así el jugador debe resolver más de un valor.
      const variants=[];
      const base=normal.map(row=>[...row]);
      const make=(changes)=>{
        const d=base.map(row=>[...row]);
        for(const [r,col,delta] of changes) d[r][col]+=delta;
        return d;
      };
      if(base.length===2 && base[0].length===2){
        variants.push(make([[0,1,1],[1,0,-1]]));
        variants.push(make([[0,1,-1],[1,1,2]]));
        variants.push(make([[1,0,2],[1,1,-2]]));
      }else{
        variants.push(make([[0,Math.min(1,base[0].length-1),1]]));
        variants.push(make([[base.length-1,0,-1]]));
        variants.push(make([[base.length-1,base[0].length-1,2]]));
      }
      variants.forEach(pushMatrix);

      // Si alguna variante coincidiera accidentalmente, se completan con
      // errores matemáticos plausibles como producto inverso, suma o
      // producto elemento a elemento.
      const reverse=matrixMultiply(c.b,c.a);
      const sum=matrixAdd(c.a,c.b);
      const elem=matrixElementwise(c.a,c.b);
      pushMatrix(reverse); pushMatrix(sum); pushMatrix(elem);
    }
    if(out.length<3){
      const variants=buildMatrixDistractors(answer)||[];
      for(const x of variants){ if(!used.has(x)){used.add(x);out.push(x);} if(out.length===3) break; }
    }
    return out.slice(0,3);
  }
  return buildMatrixDistractors(answer);
}

function buildDimensionDistractors(answer){
  const m=String(answer).match(/^(\d+)×(\d+)$/);
  if(!m) return null;
  const r=Number(m[1]),c=Number(m[2]);
  const candidates=shuffleArray([`${c}×${r}`,`${r+1}×${c}`,`${r}×${c+1}`,`${r+1}×${c+1}`,`${Math.max(1,r-1)}×${c}`,`${r}×${Math.max(1,c-1)}`]);
  const out=[],used=new Set([answer]);
  for(const s of candidates){ if(!used.has(s)){used.add(s);out.push(s);} if(out.length===3) break; }
  return out.length===3?out:null;
}

function buildMatrixDistractors(answer){
  const m=parseMatrixAnswer(answer);
  if(!m) return null;
  const variants=[];
  const used=new Set([matrixAnswerString(m)]);
  const candidates=[];
  // Diferentes tipos de error: una celda, dos celdas y pequeñas variaciones.
  for(let mode=0; mode<3; mode++){
    for(let attempt=0; attempt<30; attempt++){
      const d=m.map(r=>[...r]);
      const changes=mode===0?1:mode===1?2:Math.min(3, Math.max(1, Math.floor(d.length*d[0].length/2)));
      const positions=[];
      while(positions.length<changes){
        const pos=[Math.floor(Math.random()*d.length),Math.floor(Math.random()*d[0].length)];
        if(!positions.some(p=>p[0]===pos[0]&&p[1]===pos[1])) positions.push(pos);
      }
      positions.forEach(([r,c])=>{
        const delta=(Math.floor(Math.random()*5)+1)*(Math.random()<.5?-1:1);
        d[r][c]+=delta;
      });
      const s=matrixAnswerString(d);
      if(!used.has(s)){
        used.add(s); candidates.push(s);
        break;
      }
    }
  }
  return candidates.length===3 ? candidates : null;
}

function buildNumericDistractors(answer){
  const n=Number(answer);
  if(!Number.isFinite(n)) return null;
  const pool=[];
  const used=new Set([String(n)]);
  const offsets=shuffleArray([-3,-2,-1,1,2,3,4,-4,5,-5]);
  for(const d of offsets){
    const v=n+d;
    if(v>=0 && !used.has(String(v))){ used.add(String(v)); pool.push(String(v)); }
    if(pool.length===3) break;
  }
  return pool.length===3 ? pool : null;
}

function buildSystemDistractors(answer){
  const m=String(answer).match(/x\s*=\s*(-?\d+),\s*y\s*=\s*(-?\d+)/i);
  if(!m) return null;
  const x=Number(m[1]), y=Number(m[2]);

  // En la estación 5 se mantienen los cuatro valores de x iguales y
  // solamente cambia y. Así el jugador debe comprobar las dos ecuaciones.
  const yValues=shuffleArray([y+1,y-1,y+2,y-2,y+3,y-3]);
  const out=[], used=new Set([answer]);
  for(const value of yValues){
    const s=`x=${x}, y=${value}`;
    if(!used.has(s)){ used.add(s); out.push(s); }
    if(out.length===3) break;
  }
  return out.length===3 ? out : null;
}

function buildCoordinateDistractors(answer){
  const m=String(answer).match(/^\(\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if(!m) return null;
  const r=Number(m[1]), c=Number(m[2]);
  const candidates=shuffleArray([
    `(${r},${Math.max(1,c-1)})`, `(${r},${c+1})`,
    `(${Math.max(1,r-1)},${c})`, `(${r+1},${c})`,
    `(${c},${r})`
  ]);
  const out=[], used=new Set([answer]);
  for(const value of candidates){
    if(!used.has(value)){ used.add(value); out.push(value); }
    if(out.length===3) break;
  }
  return out.length===3 ? out : null;
}

function buildTextDistractors(c){
  // Para preguntas conceptuales se conservan los distractores educativos
  // definidos en el banco y únicamente se garantiza que haya cuatro opciones.
  if(!Array.isArray(c.opts) || c.opts.length<4) return null;
  const unique=[...new Set(c.opts.map(String))];
  const withoutAnswer=unique.filter(v=>v!==String(c.ans));
  return withoutAnswer.length>=3 ? shuffleArray(withoutAnswer).slice(0,3) : null;
}

function getDynamicOptions(c){
  let distractors=null;
  const answer=String(c.ans);

  // Todas las estaciones pasan por este mismo sistema: se generan/seleccionan
  // distractores y luego se mezclan las cuatro opciones.
  if(state.station===5){
    distractors=buildSystemDistractors(c.ans);
  }
  else if(state.station===4){
    if(c.a) distractors=buildStation4MatrixDistractors(c);
    else if(/^\d+×\d+$/.test(answer)) distractors=buildDimensionDistractors(answer);
    else if(Array.isArray(c.opts)) distractors=buildTextDistractors(c);
  }
  else if(state.station===3){
    distractors=buildMatrixDistractors(c.ans);
  }
  else if(state.station===1){
    if(/^-?\d+$/.test(answer)) distractors=buildNumericDistractors(answer);
    else if(/^\(\s*\d+\s*,\s*\d+\s*\)$/.test(answer)) distractors=buildCoordinateDistractors(answer);
    else if(Array.isArray(c.opts)) distractors=buildTextDistractors(c);
  }
  else if(state.station===2){
    distractors=buildTextDistractors(c);
  }

  // Si no se puede generar un nuevo conjunto, se usan los distractores del
  // banco original. En ambos casos la posición de la correcta se aleatoriza.
  const baseOptions=distractors ? [c.ans,...distractors] : [...(c.opts||[c.ans])];
  const uniqueOptions=[...new Set(baseOptions.map(String))];
  const options=uniqueOptions.length>=4 ? uniqueOptions.slice(0,4) : baseOptions;
  const questionKey=`${state.station}:${state.questionOrder[state.round] ?? state.round}`;
  return arrangeOptions(options,c.ans,questionKey);
}

function challengeHTML(c){
  let html="";
  const isSystem=state.station===5 && String(c.q).includes(";");
  const scalar=String(c.q).match(/Calcula\s+(-?\d+)A/i);
  if(c.visual) html+=`<div class="question-visual" aria-label="Matriz de referencia">${matrixHTML(c.visual)}</div>`;
  if(isSystem){
    html+=`<div class="question">Resuelve el sistema de ecuaciones 2×2:</div>`;
  }else if(scalar){
    html+=`<div class="question">Multiplica toda la matriz por ${scalar[1]}:</div>`;
  }else{
    html+=`<div class="question">${c.q}</div>`;
  }
  if(isSystem) html+=systemHTML(c.q);
  else if(c.matrix) html+=matrixHTML(c.matrix);
  if(c.a){
    if(scalar){
      html+=scalarHTML(c.q,c.a);
    }else if(c.type==='transpose'){
      html+=`<div class="matrix-operation">${matrixHTML(c.a)}
        <b class="operator">ᵀ</b></div>
        <div class="scalar-help">Intercambia filas por columnas para obtener la transpuesta.</div>`;
    }else if(c.type==='adjugate'){
      html+=`<div class="matrix-operation">${matrixHTML(c.a)}
        <b class="operator">Adj(A)</b></div>
        <div class="scalar-help">En una matriz 2×2, intercambia los elementos de la diagonal principal y cambia de signo los otros dos.</div>`;
    }else{
      html+=`<div class="matrix-operation">${matrixHTML(c.a)}
        <b class="operator">${c.q.includes("×") ? "×" : c.q.includes("−") ? "−" : "+"}</b>
        ${c.b ? matrixHTML(c.b) : ""}</div>`;
    }
  }
  if(c.opts){
    const shuffled=getDynamicOptions(c);
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
  state.attempts={};
  state.lastQuestionOrders={};
  state.optionHistory={};
  state.timeRemaining=0; state.timerPaused=false; state.current=null; state.code=[];
  save();
  if($("modal")) closeModal();
  updateScore();
  renderMap();
  showScreen("mapScreen");
  sound("neutral");
}

function startStation(n){
  if(n>1 && !state.completed.includes(n-1)) return;
  stopTimer();
  state.station=n; state.round=0; state.correct=0; state.roundScore=0; state.streak=0; state.timerPaused=false;
  // Cada partida recibe un orden nuevo de preguntas para evitar memorizarlas.
  // Si por azar el orden generado fuera exactamente igual al anterior,
  // se vuelve a mezclar hasta obtener uno diferente.
  const baseOrder=challenges[n].map((_,index)=>index);
  const previousOrder=state.lastQuestionOrders[n];
  let newOrder=shuffleArray(baseOrder);
  let orderTries=0;
  while(previousOrder && newOrder.every((value,index)=>value===previousOrder[index]) && orderTries<20){
    newOrder=shuffleArray(baseOrder);
    orderTries++;
  }
  state.questionOrder=newOrder;
  state.lastQuestionOrders[n]=[...newOrder];
  $("gameStationName").textContent=`${stations[n-1].icon} ${stations[n-1].title}`;
  document.documentElement.style.setProperty("--game-color",stations[n-1].color);
  showScreen("gameScreen");
  loadChallenge();
}
function loadChallenge(){
  const list=challenges[state.station];
  const questionIndex=state.questionOrder[state.round] ?? state.round;
  const c=list[questionIndex];
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

  const timeByStation={1:15,2:15,3:20,5:300};
  // En la estación 4 únicamente las dos preguntas de multiplicación de matrices
  // tienen 60 s. Todas las demás preguntas de esa estación tienen 25 s.
  const isStation4MatrixMultiplication = state.station===4 && !!state.current?.a && !!state.current?.b;
  const station4Time = isStation4MatrixMultiplication ? 60 : 25;
  state.timeRemaining = state.station===4 ? station4Time : (timeByStation[state.station]||30);
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
    const pts=state.station===5?1000:100;
    state.roundScore+=pts;
    state.score=Object.values(state.stationScores).reduce((sum,value)=>sum+Number(value||0),0)+state.roundScore;
    save(); updateScore(); sound("good");
    if(btn) btn.classList.add("correct");
    fb.className="feedback good"; fb.textContent=`✓ ¡Correcto! +${pts} puntos`;
  }else{
    state.streak=0; sound(timeout?"bad":"wrong");
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

  // Historial: máximo 5 intentos por estación. El mejor resultado se conserva
  // aparte para el sistema de récord personal.
  const history=Array.isArray(state.attempts[state.station]) ? state.attempts[state.station] : [];
  if(history.length<5){
    history.push({
      attempt:history.length+1,
      points:state.roundScore,
      stars,
      correct:state.correct,
      failed:total-state.correct,
      date:new Date().toLocaleString("es-EC")
    });
    state.attempts[state.station]=history;
  }else{
    window.alert("Memoria llena, reinicie sus estaciones.");
  }
  save(); stopTimer();
  $("resultPoints").textContent=state.roundScore;
  $("resultCorrect").textContent=`${state.correct}/${total}`;
  $("resultStars").textContent="★".repeat(stars)+"☆".repeat(3-stars);
  $("resultTitle").textContent=stars===3?"¡Dominaste la estación!":stars>=2?"¡Muy buen trabajo!":"¡Estación superada!";
  $("resultMessage").textContent=stars===3?"Tu precisión fue perfecta. Sigue así para desbloquear el código secreto.":"La estación está completada. Puedes repetirla para mejorar tus estrellas.";
  $("nextBtn").textContent=state.station<5?"SIGUIENTE ESTACIÓN →":"IR AL CÓDIGO SECRETO 🔐";
  showScreen("resultScreen"); renderHome(); renderMap();
}
function renderFinalStatistics(){
  const target=$("finalStatistics");
  if(!target) return;
  target.innerHTML=stations.map(s=>{
    const points=Number(state.stationScores[s.id]||0);
    const stars=Number(state.stars[s.id]||0);
    const attempts=Array.isArray(state.attempts[s.id])?state.attempts[s.id]:[];
    const best=attempts.reduce((acc,item)=>item.points>acc.points?item:acc,{points:0,stars:stars,correct:0,failed:challenges[s.id].length});
    const bestPoints=best.points || points;
    const bestStars=attempts.length ? best.stars : stars;
    return `<div class="final-stat-item" style="--c:${s.color}">
      <b>${s.icon} Estación ${s.id}</b>
      <div class="final-stat-line"><span>Puntos</span><strong>${bestPoints}</strong></div>
      <div class="final-stat-line"><span>Estrellas</span><strong>${"★".repeat(bestStars)}${"☆".repeat(3-bestStars)}</strong></div>
      <div class="final-stat-line"><span>Aciertos</span><strong>${best.correct}/${challenges[s.id].length}</strong></div>
      <div class="final-stat-line"><span>Falladas</span><strong>${best.failed}</strong></div>
    </div>`;
  }).join("");
}

function openAdminResults(){
  // Siempre reconstruimos la ventana con el estado actual guardado.
  // Así puede abrirse después de terminar cualquier estación sin depender
  // de que la pantalla haya sido renderizada antes.
  let html=`<h2>⚙ Administrar resultados</h2>
    <p class="admin-intro">Aquí se guardan automáticamente los resultados de cada estación. Cada estación permite hasta <b>5 intentos</b>.</p>`;

  stations.forEach(s=>{
    const attempts=Array.isArray(state.attempts[s.id]) ? state.attempts[s.id] : [];
    const best=attempts.reduce((acc,item)=>{
      if(!acc || Number(item.points)>Number(acc.points)) return item;
      if(acc && Number(item.points)===Number(acc.points) && Number(item.stars)>Number(acc.stars)) return item;
      return acc;
    },null);

    const currentBestPoints=best ? Number(best.points) : Number(state.stationScores[s.id]||0);
    const currentBestStars=best ? Number(best.stars) : Number(state.stars[s.id]||0);

    html+=`<div class="admin-station" data-admin-station="${s.id}">
      <div class="admin-station-head">
        <b>${s.icon} Estación ${s.id} · ${s.title}</b>
        <span>${attempts.length}/5 intentos</span>
      </div>
      <div class="admin-best">
        🏆 Récord personal: ${attempts.length
          ? `${currentBestPoints} puntos · ${currentBestStars} ⭐ · ${best.correct} aciertos · ${best.failed} falladas`
          : "Sin intentos todavía"}
      </div>
      <div class="attempt-list">
        ${[1,2,3,4,5].map(n=>{
          const item=attempts.find(x=>Number(x.attempt)===n);
          return item
            ? `<button class="attempt-btn" type="button" data-station="${s.id}" data-attempt="${n}">Intento ${n}</button>`
            : `<button class="attempt-btn" type="button" disabled>Intento ${n}</button>`;
        }).join("")}
      </div>
      <div class="attempt-detail" id="attemptDetail${s.id}">
        ${attempts.length ? "Selecciona un intento para ver todos sus resultados." : "No hay intentos guardados."}
      </div>
    </div>`;
  });

  $("modalContent").innerHTML=html;
  $("modal").classList.remove("hidden");
  document.body.classList.add("modal-open");

  // Los botones de Intento se crean dinámicamente, por eso usamos delegación.
  $("modalContent").onclick=(event)=>{
    const btn=event.target.closest(".attempt-btn[data-attempt]");
    if(!btn) return;
    const station=Number(btn.dataset.station);
    const attempt=Number(btn.dataset.attempt);
    const item=(state.attempts[station]||[]).find(x=>Number(x.attempt)===attempt);
    const detail=$("attemptDetail"+station);
    if(!item || !detail) return;
    const starsText="★".repeat(Number(item.stars)||0)+"☆".repeat(3-(Number(item.stars)||0));
    detail.innerHTML=`<b>Intento ${item.attempt}</b>
      <div class="attempt-detail-grid">
        <span>🏆 Puntos: <b>${item.points}</b></span>
        <span>⭐ Estrellas: <b>${starsText}</b></span>
        <span>✅ Aciertos: <b>${item.correct}</b></span>
        <span>❌ Preguntas falladas: <b>${item.failed}</b></span>
      </div>
      <small>Guardado: ${item.date}</small>`;
  };
}

function resetCodeEntry(){
  const inputs=[...document.querySelectorAll("#codeInputs input")];
  inputs.forEach(input=>{input.value="";});
  const feedback=$("finalFeedback");
  if(feedback){feedback.className="feedback"; feedback.textContent="";}
  const card=$("finalScreen")?.querySelector(".final-card");
  if(card) card.classList.remove("shake");
  const unlockButton=$("unlockBtn");
  if(unlockButton) unlockButton.disabled=false;
  if(inputs.length) inputs[0].focus();
}

function buildFinal(){
  $("finalScore").textContent=state.score;
  renderFinalStatistics();
  const vals=[1,2,3,4,5].map(n=>state.stars[n]||0);
  // Código generado automáticamente al completar las cinco estaciones.
  state.code=vals.map((stars,i)=>(i+1)+stars);
  const codeText=state.code.join(" ");
  $("secretCode").textContent=codeText;
  $("finalMapBtn").textContent="← REGRESAR A LAS ESTACIONES";
  $("finalMapBtn").setAttribute("aria-label","Regresar a las estaciones");
  $("resetCodeBtn").textContent="↻ INGRESAR CÓDIGO DE NUEVO";
  $("resultMapBtn").textContent="VER ESTACIONES";
  $("codeInputs").innerHTML=state.code.map((_,i)=>`<input maxlength="1" inputmode="numeric" aria-label="Dígito ${i+1}">`).join("");
  const inputs=[...$("codeInputs").querySelectorAll("input")];
  inputs.forEach((inp,i)=>{inp.oninput=()=>{if(inp.value && inputs[i+1]) inputs[i+1].focus();}});
  $("unlockBtn").disabled=false;
  $("finalFeedback").className="feedback";
  $("finalFeedback").textContent="";
}
function calculateFinalPercentage(){
  // El porcentaje representa el desempeño global tomando el mejor intento
  // registrado de cada estación completada.
  let correct=0, total=0;
  stations.forEach(s=>{
    const attempts=Array.isArray(state.attempts[s.id]) ? state.attempts[s.id] : [];
    const totalQuestions=challenges[s.id].length;
    total+=totalQuestions;
    if(attempts.length){
      const best=attempts.reduce((a,b)=>Number(b.correct)>Number(a.correct)?b:a,attempts[0]);
      correct+=Number(best.correct)||0;
    }
  });
  if(total<=0) return 0;
  return Math.max(1,Math.min(100,Math.round((correct/total)*100)));
}
function showCompletionMessage(){
  const percentage=calculateFinalPercentage();
  $("modalContent").innerHTML=`
    <div class="completion-modal-content">
      <div class="completion-icon">🏆</div>
      <div class="eyebrow">MISIÓN COMPLETADA</div>
      <h2>¡Felicidades, has completado el juego!</h2>
      <p>Has conseguido completar las cinco estaciones.</p>
      <div class="completion-score">
        <span>Tu puntaje final</span>
        <strong>${percentage}<small>/100</small></strong>
      </div>
      <p class="completion-prize">🎁 <b>Reclama tu premio</b></p>
    </div>`;
  $("modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  sound("good");
}
function unlock(){
  const entered=[...$("codeInputs").querySelectorAll("input")].map(x=>x.value).join("");
  const expected=state.code.join("");
  const fb=$("finalFeedback");
  if(entered===expected){
    fb.className="feedback good"; fb.textContent=`🔓 ¡CÓDIGO DESBLOQUEADO! ${expected}`;
    sound("good");
    $("secretCode").textContent=state.code.join(" ");
    $("unlockBtn").disabled=false;
    setTimeout(showCompletionMessage,350);
  }else{
    fb.className="feedback bad"; fb.textContent="🔒 Código incorrecto. Revisa el código generado y vuelve a intentarlo.";
    $("finalScreen").querySelector(".final-card").classList.add("shake");
    setTimeout(()=>$("finalScreen").querySelector(".final-card").classList.remove("shake"),400);
    sound("wrong");
  }
}

$("startBtn").onclick=()=>{startMusic();renderMap();showScreen("mapScreen")};
$("howBtn").onclick=()=>openHelp();
$("helpBtn").onclick=()=>openHelp();
$("modalClose").onclick=()=>closeModal();
$("mapBack").onclick=()=>{renderHome();showScreen("homeScreen")};
$("gameBack").onclick=()=>{stopTimer();renderMap();showScreen("mapScreen")};
$("resultMapBtn").onclick=()=>{renderMap();showScreen("mapScreen")};
$("retryBtn").onclick=()=>startStation(state.station);
$("nextBtn").onclick=()=>{
  if(state.station<5){startStation(state.station+1)}
  else {buildFinal();showScreen("finalScreen")}
};
$("unlockBtn").onclick=unlock;
$("finalMapBtn").onclick=()=>{renderMap();showScreen("mapScreen");};
$("resetCodeBtn").onclick=()=>resetCodeEntry();
// El botón de administración se enlaza de forma delegada para que siga funcionando
// aunque el contenido de la pantalla se vuelva a renderizar después de terminar una estación.
document.addEventListener("click",(event)=>{
  const adminBtn=event.target.closest("#adminResultsBtn");
  if(adminBtn){
    event.preventDefault();
    event.stopPropagation();
    openAdminResults();
  }
});
$("timerToggle").onclick=togglePause;
$("resetStationsBtn").onclick=resetStations;
$("homeBtn").onclick=()=>{stopTimer();renderHome();showScreen("homeScreen")};
$("soundBtn").onclick=()=>{
  state.sound=!state.sound; localStorage.setItem("matrix_sound",state.sound?"on":"off");
  $("soundBtn").textContent=state.sound?"🔊":"🔇";
  if(state.sound) startMusic(); else stopMusic();
};
function closeModal(){
  $("modal").classList.add("hidden");
  document.body.classList.remove("modal-open");
  if($("modalContent")) $("modalContent").onclick=null;
}

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


document.addEventListener("keydown",(event)=>{
  if(event.key==="Escape" && $("modal") && !$("modal").classList.contains("hidden")){
    closeModal();
  }
});
