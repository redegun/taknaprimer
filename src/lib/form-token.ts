export function prepareForm(action: string) {
  const url = new URL(action);
  url.searchParams.set('prepare', '1');

  const requestToken = async () => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Form preparation failed');
    const { token } = await response.json();
    if (typeof token !== 'string') throw new Error('Missing form token');
    return token;
  };

  const initialToken = requestToken().catch(() => null);
  return async (form: HTMLFormElement) => {
    const body = new FormData(form);
    let token = await initialToken;
    if (token === null) {
      token = await requestToken();
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    body.set('form_token', token);
    return body;
  };
}
