import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, errMessage: string}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, errMessage: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errMessage: error.toString() };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("React boundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div style={{color: 'red', padding: '20px'}}>App crashed visually! {this.state.errMessage}</div>;
    }
    return this.props.children;
  }
}

console.error = (...args) => {
  console.log("Suppressed error:", ...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

