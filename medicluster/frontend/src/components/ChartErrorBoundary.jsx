import React from "react";

export default class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Chart render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel h-full flex items-center justify-center text-center text-sm text-amber-300 bg-amber-950/20 border-amber-800/60">
          <div>
            <p className="font-semibold">{this.props.title ?? "Chart"} could not render.</p>
            <p className="text-xs text-amber-200/70 mt-1">
              Try another algorithm or dataset.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
