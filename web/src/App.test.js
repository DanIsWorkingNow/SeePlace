import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import store from './store/index';
import App from './App';

test('renders the SeeNoise header', () => {
  render(
    <Provider store={store}>
      <App />
    </Provider>
  );
  expect(screen.getByText(/SeeNoise/i)).toBeInTheDocument();
});
