/**
 * Runs a callback on a repeating interval that automatically pauses when the page enters the
 * back/forward cache (`freeze` event) and resumes when the user navigates back (`resume` event).
 *
 * Returns a function that stops the interval and removes the lifecycle listeners.
 */
export function keepAlive(callback: () => void, interval: number): () => void {
  let id: ReturnType<typeof setInterval> | undefined;

  const start = () => {
    stop();
    id = setInterval(callback, interval);
  };

  const stop = () => {
    if (id !== undefined) {
      clearInterval(id);
      id = undefined;
    }
  };

  const onFreeze = () => stop();
  const onResume = () => start();

  document.addEventListener('freeze', onFreeze);
  document.addEventListener('resume', onResume);

  start();

  return () => {
    stop();
    document.removeEventListener('freeze', onFreeze);
    document.removeEventListener('resume', onResume);
  };
}
