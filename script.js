/* ============================================================
   script.js — Smart Traffic Intersection Simulator
   Web Development Class — Session 1 Scaffold
   ============================================================ */

/* ─────────────────────────────────────────────────────────────
   STATE
   Holds the current values of everything the app needs to track.
───────────────────────────────────────────────────────────── */
const State = {
  ns: 'stop',           // 'go' | 'warning' | 'stop'
  ew: 'go',            // 'go' | 'warning' | 'stop'
  mode: 'manual',       // 'manual' | 'timed'
  transitioning: false, // true while a transition animation is running
  timedTimeout: null,   // holds the setTimeout reference for timed mode
  pendingPedestrian: false, // true when a pedestrian crossing has been requested
  pedInterval: null,    // interval used for pedestrian countdown UI
  movementRaf: null,    // requestAnimationFrame id
  lastFrameTime: 0,     // previous timestamp in movement loop
  ewOffset: 0,
  nsOffset: 0,
  pedOffset: 0,
  phaseEndAt: 0,
  countdownInterval: null,
  timedPedPhase: 'stop', // 'go' | 'warning' | 'stop'
  timedPedRequested: false,
  timedPedPhaseTimeout: null,
  timedPedCountdownInterval: null,
  timedPedPhaseEndAt: 0,
};

/* ─────────────────────────────────────────────────────────────
   DOM REFERENCES
   Get all the elements we need to read or change.
   We use a helper function $() so we can write $('id')
   instead of document.getElementById('id') every time.
───────────────────────────────────────────────────────────── */
function $(id) {
  return document.getElementById(id);
}

// Light bulb elements for each lane
const nsLights = {
  red:    $('ns-red'),
  yellow: $('ns-yellow'),
  green:  $('ns-green'),
};

const ewLights = {
  red:    $('ew-red'),
  yellow: $('ew-yellow'),
  green:  $('ew-green'),
};

// State text labels below each light
const nsStateText = $('ns-state-text');
const ewStateText = $('ew-state-text');

// Controls
const modeSlider     = $('mode-slider');
const manualControls = $('manual-controls');
const timedControls  = $('timed-controls');
const btnTransition  = $('btn-transition');
const btnPedestrian  = $('btn-pedestrian');
const btnStartTimed  = $('btn-start-timed');
const btnStopTimed   = $('btn-stop-timed');
const nsTimeInput    = $('ns-time');
const ewTimeInput    = $('ew-time');
const pedTimeInput   = $('ped-time');
const clearanceTimeInput = $('clearance-time');
const logContainer   = $('log-container');
const btnClearLog    = $('btn-clear-log');
const labelManual    = $('label-manual');
const labelTimed     = $('label-timed');
const pedSignal      = $('ped-signal');
const pedIcon        = $('ped-icon');
const pedStatus      = $('ped-status');
const pedTimer       = $('ped-timer');
const pedRedLight = $('ped-red-light');
const pedGreenLight = $('ped-green-light');
const transitionDelayInput = $('transition-delay');
const roadEwStrip = $('road-ew-strip');
const roadNsStrip = $('road-ns-strip');
const carNs1 = $('car-ns-1');
const carNs2 = $('car-ns-2');
const carEw1 = $('car-ew-1');
const carEw2 = $('car-ew-2');
const ped1 = $('ped-1');
const ped2 = $('ped-2');
const ped3 = $('ped-3');
const nsCountdownBox = $('ns-countdown-box');
const nsCountdownLabel = $('ns-countdown-label');
const nsCountdownValue = $('ns-countdown-value');
const nsCountdownCaption = $('ns-countdown-caption');
const ewCountdownBox = $('ew-countdown-box');
const ewCountdownLabel = $('ew-countdown-label');
const ewCountdownValue = $('ew-countdown-value');
const ewCountdownCaption = $('ew-countdown-caption');
const pedCountdownBox = $('ped-countdown-box');
const pedCountdownLabel = $('ped-countdown-label');
const pedCountdownValue = $('ped-countdown-value');
const pedCountdownCaption = $('ped-countdown-caption');
const crosswalkPhaseLabel = $('crosswalk-phase-label');

function getTransitionDelaySeconds() {
  const value = parseFloat(transitionDelayInput && transitionDelayInput.value);
  const safeValue = Number.isFinite(value) ? value : 1.5;
  return Math.min(10, Math.max(0.5, safeValue));
}

function getBoundedSeconds(input, fallback, min, max) {
  const parsed = parseFloat(input && input.value);
  const safe = Number.isFinite(parsed) ? parsed : fallback;
  const bounded = Math.max(min, Math.min(max, safe));
  if (input) {
    input.value = String(bounded);
  }
  return bounded;
}

function getTimedSettings() {
  return {
    nsSeconds: getBoundedSeconds(nsTimeInput, 10, 3, 180),
    ewSeconds: getBoundedSeconds(ewTimeInput, 7, 3, 180),
    pedestrianSeconds: getBoundedSeconds(pedTimeInput, 5, 2, 90),
    clearanceSeconds: getBoundedSeconds(clearanceTimeInput, 2, 0.5, 30),
  };
}

function setCountdownUI(box, labelEl, valueEl, captionEl, state, label, value, caption) {
  if (!box || !labelEl || !valueEl || !captionEl) return;
  box.classList.remove('state-go', 'state-warning', 'state-stop');
  box.classList.add(
    state === 'go' ? 'state-go' : (state === 'warning' ? 'state-warning' : 'state-stop')
  );
  labelEl.textContent = label;
  valueEl.textContent = String(Math.max(0, Math.ceil(value)));
  captionEl.textContent = caption;
}

function renderVehicleCountdowns(remainingSeconds) {
  const nsLabel = State.ns === 'go' ? 'GREEN' : (State.ns === 'warning' ? 'YELLOW' : 'RED');
  const ewLabel = State.ew === 'go' ? 'GREEN' : (State.ew === 'warning' ? 'YELLOW' : 'RED');
  const nsCaption = State.ns === 'go' ? 'Switching soon' : (State.ns === 'warning' ? 'Prepare to stop' : 'Until green');
  const ewCaption = State.ew === 'go' ? 'Switching soon' : (State.ew === 'warning' ? 'Prepare to stop' : 'Until green');
  setCountdownUI(nsCountdownBox, nsCountdownLabel, nsCountdownValue, nsCountdownCaption, State.ns, nsLabel, remainingSeconds, nsCaption);
  setCountdownUI(ewCountdownBox, ewCountdownLabel, ewCountdownValue, ewCountdownCaption, State.ew, ewLabel, remainingSeconds, ewCaption);
}

function setPhaseCountdown(seconds) {
  clearInterval(State.countdownInterval);
  State.phaseEndAt = Date.now() + (Math.max(0, seconds) * 1000);
  renderVehicleCountdowns(seconds);
  State.countdownInterval = setInterval(function () {
    const remaining = Math.max(0, (State.phaseEndAt - Date.now()) / 1000);
    renderVehicleCountdowns(remaining);
    if (remaining <= 0.02) {
      clearInterval(State.countdownInterval);
      State.countdownInterval = null;
    }
  }, 200);
}

function clearTimedPedestrianTimers() {
  clearTimeout(State.timedPedPhaseTimeout);
  clearInterval(State.timedPedCountdownInterval);
  State.timedPedPhaseTimeout = null;
  State.timedPedCountdownInterval = null;
  State.timedPedPhaseEndAt = 0;
}

function getTimedPedestrianPhaseDurations(settings) {
  const baseStop = Math.max(3, settings.nsSeconds + settings.ewSeconds);
  return {
    go: settings.pedestrianSeconds,
    warning: Math.max(1, settings.clearanceSeconds),
    stop: State.timedPedRequested ? Math.min(4, baseStop) : baseStop,
  };
}

function updateTimedPedPhase(phase, remainingSeconds) {
  const safeRemaining = Math.max(0, remainingSeconds);
  if (phase === 'go') {
    setPedestrianSignal(true, safeRemaining, 'go');
    return;
  }
  if (phase === 'warning') {
    setPedestrianSignal(false, safeRemaining, 'warning');
    return;
  }
  setPedestrianSignal(false, safeRemaining, 'stop');
}

function runTimedPedestrianCycle(settings, forcedPhase) {
  if (State.mode !== 'timed') return;
  const phaseDurations = getTimedPedestrianPhaseDurations(settings);
  const phase = forcedPhase || State.timedPedPhase || 'stop';
  const duration = phaseDurations[phase] || phaseDurations.stop;
  State.timedPedPhase = phase;
  State.timedPedPhaseEndAt = Date.now() + (duration * 1000);

  clearInterval(State.timedPedCountdownInterval);
  updateTimedPedPhase(phase, duration);
  State.timedPedCountdownInterval = setInterval(function () {
    const remaining = Math.max(0, (State.timedPedPhaseEndAt - Date.now()) / 1000);
    updateTimedPedPhase(phase, remaining);
    if (remaining <= 0.02) {
      clearInterval(State.timedPedCountdownInterval);
      State.timedPedCountdownInterval = null;
    }
  }, 200);

  clearTimeout(State.timedPedPhaseTimeout);
  State.timedPedPhaseTimeout = setTimeout(function () {
    let nextPhase = 'stop';
    if (phase === 'stop') {
      nextPhase = 'go';
      State.timedPedRequested = false;
      if (btnPedestrian) btnPedestrian.disabled = false;
    } else if (phase === 'go') {
      nextPhase = 'warning';
    } else if (phase === 'warning') {
      nextPhase = 'stop';
    }
    runTimedPedestrianCycle(settings, nextPhase);
  }, duration * 1000);
}

function getLaneSpeed(state) {
  if (state === 'go') return 3.2;
  if (state === 'warning') return 1.2;
  return 0;
}

function wrap(value, max) {
  if (max <= 0) return value;
  return ((value % max) + max) % max;
}

function renderMovers(deltaMs) {
  if (!roadEwStrip || !roadNsStrip) return;
  const ewWidth = roadEwStrip.clientWidth || 700;
  const nsWidth = roadNsStrip.clientWidth || 700;
  const pedWrap = ewWidth + 120;
  const nsSpeed = getLaneSpeed(State.ns);
  const ewSpeed = getLaneSpeed(State.ew);
  const pedWalk = pedStatus && pedStatus.textContent === 'WALK';
  const pedSpeed = pedWalk ? 1.8 : 0;

  const frameScale = deltaMs / 16.6667;
  State.ewOffset += ewSpeed * frameScale;
  State.nsOffset += nsSpeed * frameScale;
  State.pedOffset += pedSpeed * frameScale;

  const ewCycle = ewWidth + 180;
  const nsCycle = nsWidth + 180;
  const pedCycle = pedWrap + 90;

  const ew1X = wrap(State.ewOffset + 0, ewCycle) - 80;
  const ew2X = wrap(State.ewOffset - (ewCycle / 2), ewCycle) - 80;
  const ns1X = wrap(State.nsOffset + 0, nsCycle) - 80;
  const ns2X = wrap(State.nsOffset - (nsCycle / 2), nsCycle) - 80;
  const p1X = wrap(State.pedOffset + 0, pedCycle) - 24;
  const p2X = wrap(State.pedOffset - 80, pedCycle) - 24;
  const p3X = wrap(State.pedOffset - 160, pedCycle) - 24;

  if (carNs1) carNs1.style.transform = 'translateX(' + ns1X + 'px)';
  if (carNs2) carNs2.style.transform = 'translateX(' + ns2X + 'px)';
  if (carEw1) carEw1.style.transform = 'translateX(' + ew1X + 'px)';
  if (carEw2) carEw2.style.transform = 'translateX(' + ew2X + 'px)';
  if (ped1) ped1.style.transform = 'translateX(' + p1X + 'px)';
  if (ped2) ped2.style.transform = 'translateX(' + p2X + 'px)';
  if (ped3) ped3.style.transform = 'translateX(' + p3X + 'px)';

  if (ped1) ped1.classList.toggle('walking', pedWalk);
  if (ped2) ped2.classList.toggle('walking', pedWalk);
  if (ped3) ped3.classList.toggle('walking', pedWalk);
}

function startMovementLoop() {
  if (State.movementRaf) {
    cancelAnimationFrame(State.movementRaf);
  }

  function tick(timestamp) {
    if (!State.lastFrameTime) {
      State.lastFrameTime = timestamp;
    }

    const deltaMs = Math.min(40, timestamp - State.lastFrameTime);
    State.lastFrameTime = timestamp;
    renderMovers(deltaMs);
    State.movementRaf = requestAnimationFrame(tick);
  }

  State.lastFrameTime = 0;
  State.movementRaf = requestAnimationFrame(tick);
}

function setPedestrianSignal(isWalk, secondsRemaining, pedPhase) {
  if (!pedStatus || !pedIcon || !pedTimer) return;

  const phase = pedPhase || (isWalk ? 'go' : 'stop');
  pedStatus.classList.remove('walk', 'stop', 'warning');
  if (phase === 'warning') {
    pedStatus.textContent = 'CLEAR';
    pedStatus.classList.add('warning');
  } else if (phase === 'go') {
    pedStatus.textContent = 'WALK';
    pedStatus.classList.add('walk');
  } else {
    pedStatus.textContent = "DON'T WALK";
    pedStatus.classList.add('stop');
  }

  const safeSeconds = Math.max(0, Number(secondsRemaining) || 0);
  pedTimer.textContent = safeSeconds > 0 ? String(safeSeconds) : '';
  pedTimer.classList.toggle('is-hidden', safeSeconds === 0);

  // Start the "walking" animation when the timer is close to zero
  const shouldAnimate = phase === 'go' && safeSeconds <= 2 && safeSeconds > 0;
  pedIcon.classList.toggle('walking', shouldAnimate);
  if (pedRedLight) pedRedLight.classList.toggle('active', phase !== 'go');
  if (pedGreenLight) pedGreenLight.classList.toggle('active', phase === 'go');

  if (ped1) ped1.classList.toggle('walking', phase === 'go');
  if (ped2) ped2.classList.toggle('walking', phase === 'go');
  if (ped3) ped3.classList.toggle('walking', phase === 'go');

  const pedState = phase === 'go' ? 'go' : (phase === 'warning' ? 'warning' : 'stop');
  const pedLabel = phase === 'go' ? 'GREEN' : (phase === 'warning' ? 'YELLOW' : 'RED');
  const pedCaption = phase === 'go'
    ? 'Cross now'
    : (phase === 'warning'
      ? 'Finish crossing'
      : (State.timedPedRequested ? 'Queued request' : 'Wait'));
  setCountdownUI(
    pedCountdownBox,
    pedCountdownLabel,
    pedCountdownValue,
    pedCountdownCaption,
    pedState,
    pedLabel,
    safeSeconds,
    pedCaption
  );

  if (crosswalkPhaseLabel) {
    crosswalkPhaseLabel.classList.remove('state-go', 'state-warning', 'state-stop');
    crosswalkPhaseLabel.classList.add(
      phase === 'go' ? 'state-go' : (phase === 'warning' ? 'state-warning' : 'state-stop')
    );
    if (phase === 'go') {
      crosswalkPhaseLabel.textContent = 'Section: Intersection Crosswalk - GREEN (Walk)';
    } else if (phase === 'warning') {
      crosswalkPhaseLabel.textContent = 'Section: Intersection Crosswalk - YELLOW (Clear)';
    } else {
      crosswalkPhaseLabel.textContent = 'Section: Intersection Crosswalk - RED (Wait)';
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   RENDER LIGHT
   Updates the bulbs and state label for one traffic light.

   Parameters:
     lights    — the object with .red, .yellow, .green elements
     stateText — the <div> that shows the text label
     state     — 'go' | 'warning' | 'stop'
───────────────────────────────────────────────────────────── */
function renderLight(lights, stateText, state) {
  // Turn off all bulbs first
  lights.red.classList.remove('active');
  lights.yellow.classList.remove('active');
  lights.green.classList.remove('active');

  // Turn on the correct bulb and update the label
  if (state === 'stop') {
    lights.red.classList.add('active');
    stateText.textContent = 'STOP';
    stateText.style.color = '#ef4444';
  } else if (state === 'warning') {
    lights.yellow.classList.add('active');
    stateText.textContent = 'SLOW';
    stateText.style.color = '#eab308';
  } else {
    // state === 'go'
    lights.green.classList.add('active');
    stateText.textContent = 'GO';
    stateText.style.color = '#22c55e';
  }
}

/* ─────────────────────────────────────────────────────────────
   RENDER ALL
   Re-renders both traffic lights using the current State values.
───────────────────────────────────────────────────────────── */
function renderAll() {
  renderLight(nsLights, nsStateText, State.ns);
  renderLight(ewLights, ewStateText, State.ew);
  if (State.mode !== 'timed' && !State.transitioning) {
    renderVehicleCountdowns(0);
  }

  // In manual mode, keep pedestrian signal synced with E–W red by default.
  if (State.mode !== 'timed' && !State.pendingPedestrian && !State.pedInterval) {
    if (State.ew === 'stop') {
      setPedestrianSignal(true, 0);
    } else {
      setPedestrianSignal(false, 0);
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   LOG
   Adds a new entry to the Event Log panel.

   Parameters:
     message — the text to display
     type    — 'info' | 'success' | 'warning' | 'danger'
───────────────────────────────────────────────────────────── */
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + type;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

  entry.innerHTML = '<span class="log-time">[' + timeStr + ']</span>' + message;

  // Add newest entries at the top
  logContainer.prepend(entry);

  // Keep only the last 80 entries to avoid memory issues
  while (logContainer.children.length > 80) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

/* ─────────────────────────────────────────────────────────────
   RUN MANUAL TRANSITION
   Triggers a full transition sequence:
     Active lane:  go → warning (1.5s) → stop
     Waiting lane: stop → go

   Parameters:
     callback — optional function to call when transition is done
───────────────────────────────────────────────────────────── */
function runManualTransition(callback, options) {
  // Don't start a new transition if one is already running
  if (State.transitioning) return;

  State.transitioning = true;
  btnTransition.disabled = true;

  // Figure out which lane is currently going
  const activeIsNS = (State.ns === 'go');
  const activeLane  = activeIsNS ? 'N–S' : 'E–W';
  const waitingLane = activeIsNS ? 'E–W' : 'N–S';

  log('🔄 Transition triggered — ' + activeLane + ' going to WARNING', 'warning');
  const yellowMs = Math.round(getTransitionDelaySeconds() * 1000);
  const clearanceSeconds = options && Number.isFinite(options.clearanceSeconds)
    ? options.clearanceSeconds
    : (yellowMs * 0.4 / 1000);
  const redSwapMs = Math.max(400, Math.round(Math.max(0.2, clearanceSeconds) * 1000));

  // Step 1: Active lane → WARNING
  if (activeIsNS) {
    State.ns = 'warning';
  } else {
    State.ew = 'warning';
  }
  renderAll();
  setPhaseCountdown(yellowMs / 1000);

  // Step 2: After 1.5s → active lane goes to STOP
  setTimeout(function () {
    log('🛑 ' + activeLane + ' → STOP', 'danger');

    if (activeIsNS) {
      State.ns = 'stop';
    } else {
      State.ew = 'stop';
    }
    renderAll();
    setPhaseCountdown(redSwapMs / 1000);

    // Step 3: After 0.6s → waiting lane goes to GO
    setTimeout(function () {
      log('✅ ' + waitingLane + ' → GO', 'success');

      if (activeIsNS) {
        State.ew = 'go';
      } else {
        State.ns = 'go';
      }
      renderAll();

      // Transition complete
      State.transitioning = false;
      btnTransition.disabled = false;

      // Call the optional callback (used by timed mode)
      if (typeof callback === 'function') {
        callback();
      }

      // Handle any pending pedestrian crossing after the transition
      if (State.pendingPedestrian) {
        State.pendingPedestrian = false;

        if (btnPedestrian) {
          btnPedestrian.disabled = true;
        }

        clearInterval(State.pedInterval);
        State.pedInterval = null;

        // Remember the traffic state right after the transition
        const nsAfterTransition = State.ns;
        const ewAfterTransition = State.ew;

        // Both directions stop for pedestrians
        State.ns = 'stop';
        State.ew = 'stop';
        renderAll();
        log('🚶 WALK — Pedestrians crossing', 'info');

        // Start pedestrian countdown UI (5 → 0)
        const settings = getTimedSettings();
        let remaining = settings.pedestrianSeconds;
        setPedestrianSignal(true, remaining, 'go');
        State.pedInterval = setInterval(function () {
          remaining -= 1;
          setPedestrianSignal(true, remaining, 'go');
          if (remaining <= 0) {
            clearInterval(State.pedInterval);
            State.pedInterval = null;
            // End pedestrian signal at zero (stop animation + text)
            setPedestrianSignal(false, 0, 'stop');
          }
        }, 1000);

        // After configured pedestrian delay, restore traffic and re-enable the button
        setTimeout(function () {
          clearInterval(State.pedInterval);
          State.pedInterval = null;
          setPedestrianSignal(false, 0, 'stop');

          State.ns = nsAfterTransition;
          State.ew = ewAfterTransition;
          renderAll();

          if (btnPedestrian) {
            btnPedestrian.disabled = false;
          }
        }, settings.pedestrianSeconds * 1000);
      } else if (btnPedestrian) {
        // Ensure the pedestrian button is enabled when no request is pending
        btnPedestrian.disabled = false;
      }

    }, redSwapMs);
  }, yellowMs);
}

/* ─────────────────────────────────────────────────────────────
   START TIMED MODE
   Reads the time inputs and starts the automatic cycle:
     - Set N–S to GO, E–W to STOP as the starting state
     - Wait for the go time, then trigger a transition
     - After the transition, wait the other lane's go time, repeat
───────────────────────────────────────────────────────────── */
function startTimedMode() {
  const settings = getTimedSettings();
  const nsSeconds = settings.nsSeconds;
  const ewSeconds = settings.ewSeconds;
  const clearanceSeconds = settings.clearanceSeconds;

  log('⏱ Timed mode started — N–S: ' + nsSeconds + 's | E–W: ' + ewSeconds + 's', 'info');

  // Set initial state: N–S goes first
  State.ns = 'go';
  State.ew = 'stop';
  renderAll();
  log('✅ N–S → GO (starting)', 'success');

  // Kick off the cycle
  runTimedCycle(nsSeconds, ewSeconds, clearanceSeconds);
  clearTimedPedestrianTimers();
  State.timedPedRequested = false;
  State.timedPedPhase = 'stop';
  runTimedPedestrianCycle(settings, 'stop');
}

/* ─────────────────────────────────────────────────────────────
   RUN TIMED CYCLE
   Internal helper — schedules the next transition after
   the correct go time for the currently active lane.
───────────────────────────────────────────────────────────── */
function runTimedCycle(nsSeconds, ewSeconds, clearanceSeconds) {
  // Stop if mode was switched away
  if (State.mode !== 'timed') return;

  // How long should the current GO lane stay green?
  const currentGoTime = (State.ns === 'go') ? nsSeconds : ewSeconds;
  setPhaseCountdown(currentGoTime);

  State.timedTimeout = setTimeout(function () {
    runManualTransition(function () {
      // After transition, schedule the next one
      runTimedCycle(nsSeconds, ewSeconds, clearanceSeconds);
    }, { clearanceSeconds: clearanceSeconds });
  }, currentGoTime * 1000);
}

/* ─────────────────────────────────────────────────────────────
   STOP TIMED MODE
   Cancels any pending timeouts and resets transitioning state.
───────────────────────────────────────────────────────────── */
function stopTimedMode() {
  clearTimeout(State.timedTimeout);
  clearInterval(State.countdownInterval);
  State.countdownInterval = null;
  State.timedTimeout = null;
  State.transitioning = false;
  State.phaseEndAt = 0;
  clearTimedPedestrianTimers();
  State.timedPedRequested = false;
  State.timedPedPhase = 'stop';
  btnTransition.disabled = false;
  if (btnPedestrian) btnPedestrian.disabled = false;
  renderVehicleCountdowns(0);
  setPedestrianSignal(false, 0, 'stop');
  log('⏹ Timed mode stopped', 'warning');
}

/* ─────────────────────────────────────────────────────────────
   EVENT LISTENERS
   Connect each button and control to the correct function.
───────────────────────────────────────────────────────────── */

// Manual transition button
btnTransition.addEventListener('click', function () {
  runManualTransition();
});

// Pedestrian request button
btnPedestrian.addEventListener('click', function () {
  if (State.mode === 'timed') {
    const settings = getTimedSettings();
    if (State.timedPedPhase === 'stop') {
      State.timedPedRequested = false;
      clearTimedPedestrianTimers();
      runTimedPedestrianCycle(settings, 'go');
      log('🚶 Pedestrian cycle started in TIMED mode', 'info');
      return;
    }

    if (State.timedPedRequested) return;
    State.timedPedRequested = true;
    btnPedestrian.disabled = true;
    log('🚶 Pedestrian request queued — starts on next RED phase', 'info');
    return;
  }

  if (State.pendingPedestrian) return;

  btnPedestrian.disabled = true;
  State.pendingPedestrian = true;
  log('🚶 Pedestrian crossing requested — will activate after the next transition', 'info');
});

// Timed mode — Start button
btnStartTimed.addEventListener('click', function () {
  stopTimedMode(); // clear any previous cycle first
  startTimedMode();
});

// Timed mode — Stop button
btnStopTimed.addEventListener('click', function () {
  stopTimedMode();
});

// Mode slider — switches between Manual and Timed
modeSlider.addEventListener('input', function () {
  const isTimed = modeSlider.value === '1';

  if (isTimed) {
    State.mode = 'timed';
    manualControls.classList.add('hidden');
    timedControls.classList.remove('hidden');
    labelManual.classList.remove('active-label');
    labelTimed.classList.add('active-label');
    log('🔀 Switched to TIMED mode', 'info');
  } else {
    State.mode = 'manual';
    stopTimedMode();
    timedControls.classList.add('hidden');
    manualControls.classList.remove('hidden');
    labelTimed.classList.remove('active-label');
    labelManual.classList.add('active-label');
    log('🔀 Switched to MANUAL mode', 'info');
  }
});

// Clear log button
btnClearLog.addEventListener('click', function () {
  logContainer.innerHTML = '';
});

if (transitionDelayInput) {
  transitionDelayInput.addEventListener('change', function () {
    const fixed = getTransitionDelaySeconds();
    transitionDelayInput.value = String(fixed);
    log('⏲ Transition delay set to ' + fixed + 's', 'info');
  });
}

/* ─────────────────────────────────────────────────────────────
   INIT
   Run when the page first loads — render the initial state.
───────────────────────────────────────────────────────────── */
renderAll();
log('🚦 Traffic Simulator initialized', 'info');
log('N–S: STOP | E–W: GO', 'success');
setPedestrianSignal(false, 0);
startMovementLoop();
