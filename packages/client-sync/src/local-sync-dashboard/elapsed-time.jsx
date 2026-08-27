import {React, ReactDOM} from 'nylas-exports';
import PropTypes from 'prop-types';

setInterval(() => {
  const event = new Event('tick');
  window.dispatchEvent(event);
}, 1000);

export default class ElapsedTime extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      elapsed: 0,
    }
  }

  componentDidMount() {
    this.onTick = () => {
      ReactDOM.findDOMNode(this.refs.timestamp).innerHTML = this.props.formatTime(
        Date.now() - this.props.refTimestamp
      );
    };
    window.addEventListener('tick', this.onTick);
  }

  componentWillUnmount() {
    window.removeEventListener('tick', this.onTick);
  }

  render() {
    return <span ref="timestamp" />
  }
}

ElapsedTime.propTypes = {
  refTimestamp: PropTypes.number, // milliseconds
  formatTime: PropTypes.func,
}
