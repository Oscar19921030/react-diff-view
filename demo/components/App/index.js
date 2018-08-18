import {PureComponent} from 'react';
import {uniqueId} from 'lodash';
import {bind} from 'lodash-decorators';
import {Button, Radio, Checkbox} from 'antd';
import 'antd/dist/antd.css';
import InfiniteScroll from 'react-infinite-scroller';
import sha from 'sha1';
import {formatLines, diffLines} from 'unidiff';
import File from '../File';
import ManualInput from '../ManualInput';
import './index.css';
import ParseWorker from './Parse.worker'; // eslint-disable-line import/default

const ButtonGroup = Button.Group;
const RadioButton = Radio.Button;
const RadioGroup = Radio.Group;

export default class App extends PureComponent {

    state = {
        zip: true,
        hideGutter: false,
        diff: [],
        rendering: [],
        diffText: '',
        viewType: 'split'
    };

    jobID = null;

    constructor(props) {
        super(props);

        this.parser = new ParseWorker();
        this.parser.addEventListener(
            'message',
            ({data: {jobID, diff}}) => {
                if (jobID === this.jobID) {
                    this.setState({diff: diff, rendering: diff.slice(0, 1)});
                }
            }
        );
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.zip !== this.state.zip || prevState.diffText !== this.state.diffText) {
            const {zip, diffText} = this.state;
            const nearbySequences = zip ? 'zip' : null;

            const jobID = uniqueId();
            this.parser.postMessage({jobID, diffText, nearbySequences});
            this.jobID = jobID;
        }
    }

    @bind()
    switchViewType(e) {
        this.setState({viewType: e.target.value});
    }

    @bind()
    changeZipType(e) {
        this.setState({zip: e.target.checked});
    }

    @bind()
    changeHideGutter(e) {
        this.setState({hideGutter: e.target.checked});
    }

    @bind()
    receiveNewDiff(oldText, newText) {
        const diffText = formatLines(diffLines(oldText, newText), {context: 3});
        const oldVersion = sha(uniqueId()).slice(0, 9);
        const newVersion = sha(uniqueId()).slice(0, 9);
        const header = `diff --git a/a b/b\nindex ${oldVersion}..${newVersion} 100644`;
        const gitDiffText = header + '\n' + diffText;
        this.setState({diffText: gitDiffText});
    }

    async loadPreset(type) {
        const response = await fetch(`assets/${type}.diff`);
        const diffText = await response.text();
        this.setState({diffText});
    }

    @bind()
    loadMoreFile() {
        const {diff, rendering} = this.state;
        this.setState({rendering: diff.slice(0, rendering.length + 1)});
    }

    render() {
        const {diff, rendering, zip, hideGutter, viewType} = this.state;
        const renderFile = file => (
            <File
                key={file.oldRevision + '-' + file.newRevision}
                {...file}
                hideGutter={hideGutter}
                viewType={viewType}
            />
        );

        /* eslint-disable react/jsx-no-bind, react/no-array-index-key */
        return (
            <div className="app">
                <header className="config">
                    <div>
                        <Checkbox size="large" checked={hideGutter} onChange={this.changeHideGutter}>
                            Hide gutter column
                        </Checkbox>
                    </div>
                    <div>
                        <Checkbox size="large" checked={zip} onChange={this.changeZipType}>
                            Zip nearby sequences
                        </Checkbox>
                    </div>
                    <div>
                        <RadioGroup size="large" value={viewType} onChange={this.switchViewType}>
                            <RadioButton value="split">Split</RadioButton>
                            <RadioButton value="unified">Unified</RadioButton>
                        </RadioGroup>
                    </div>
                    <div>
                        <ButtonGroup>
                            <Button
                                className="preset"
                                onClick={() => this.loadPreset('small')}
                                size="large"
                            >
                                Small preset
                            </Button>
                            <Button
                                className="preset"
                                onClick={() => this.loadPreset('medium')}
                                size="large"
                            >
                                Medium preset (slow)
                            </Button>
                            <Button
                                className="preset"
                                onClick={() => this.loadPreset('large')}
                                size="large"
                            >
                                Large preset (very slow)
                            </Button>
                        </ButtonGroup>
                    </div>
                </header>
                <ManualInput onSubmit={this.receiveNewDiff} />
                <div className="main">
                    <InfiniteScroll
                        pageStart={0}
                        loadMore={this.loadMoreFile}
                        hasMore={diff.length > rendering.length}
                    >
                        {rendering.map(renderFile)}
                    </InfiniteScroll>
                </div>
            </div>
        );
        /* eslint-enable react/jsx-no-bind, react/no-array-index-key */
    }
}