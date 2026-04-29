// AudioWorklet processor that buffers mic input into ~4096-sample chunks
// and posts them to the main thread, where they are fed to the Vosk recognizer.
class VoskRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufSize = 4096;
    this.buf = new Float32Array(this.bufSize);
    this.pos = 0;
    this.frameCount = 0;
    this._loggedFirst = false;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (!this._loggedFirst) {
      this._loggedFirst = true;
      // eslint-disable-next-line no-undef
      console.log('[worklet] first process(), inputLen=', input?.[0]?.length, 'channels=', input?.length);
    }
    if (!input || !input[0]) return true;
    const data = input[0]; // mono channel, 128 samples per quantum
    for (let i = 0; i < data.length; i++) {
      this.buf[this.pos++] = data[i];
      if (this.pos >= this.bufSize) {
        this.port.postMessage(this.buf.slice());
        this.pos = 0;
        this.frameCount++;
      }
    }
    // Pass-through to output (silenced downstream by a 0-gain node) so the
    // audio graph treats this node as live and keeps invoking process().
    const output = outputs[0];
    if (output && output[0]) {
      output[0].set(data);
    }
    return true;
  }
}

registerProcessor('vosk-recorder', VoskRecorderProcessor);
