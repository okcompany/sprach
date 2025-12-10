
const React = require('react');

// This is a proxy that catches any import from 'lucide-react'
// and returns a mock React component.
const lucideMock = new Proxy({}, {
  get: function(target, prop) {
    // Return a simple forwardRef component for any icon
    const Component = React.forwardRef((props, ref) => {
      // Create a generic SVG element
      return React.createElement('svg', { ...props, ref, 'data-testid': `icon-${prop}` });
    });
    Component.displayName = prop; // For better debugging
    return Component;
  }
});

module.exports = lucideMock;
