/** Writes text to the clipboard, and tells whether it did. A refusal from the browser is logged, not thrown. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to the clipboard:', error);
    return false;
  }
}
