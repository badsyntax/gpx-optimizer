// eslint-disable-next-line no-unused-vars
import { h, app } from 'hyperapp';
import classNames from 'classnames/bind';
import 'purecss/build/base.css';
import {
  pureForm,
  pureFormAligned,
  pureControlGroup,
  pureControls,
  pureFormMessageInline
} from 'purecss/build/forms.css';
import { pureButton, pureButtonPrimary } from 'purecss/build/buttons.css';
import STYLES from './index.css';
import VectorSource from 'ol/source/Vector';
import GPX from 'ol/format/GPX';
import GeometryType from 'ol/geom/GeometryType';
import { saveAs } from 'file-saver';
import debounce from 'lodash.debounce';

import progressIndicator from './progressIndicator';

const { MULTI_LINE_STRING } = GeometryType;

if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
  alert('The File APIs are not fully supported in this browser.');
}

const c = classNames.bind(STYLES);

const state = {
  count: 0,
  file: null,
  source: null,
  originalSource: null,
  tolerance: 50,
  xmlBlob: null
};

const friendlyFileSize = size => {
  var i = Math.floor(Math.log(size) / Math.log(1024));
  return (
    (size / Math.pow(1024, i)).toFixed(2) * 1 +
    ` ${['B', 'kB', 'MB', 'GB', 'TB'][i]}`
  );
};

const getMultiLineCoords = source => {
  const features = source ? source.getFeatures() : [];
  const multiLineStringFeature = features.find(
    feature => feature.getGeometry().getType() === MULTI_LINE_STRING
  );
  const coords = multiLineStringFeature
    ? multiLineStringFeature
        .getGeometry()
        .getCoordinates()
        .flat()
    : [];
  return coords;
};

const actions = {
  onFileChange: evt => (state, actions) => {
    progressIndicator.show();
    const file = evt.target.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      progressIndicator.hide();

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(reader.result, 'text/xml');
      const parserError = xmlDoc.getElementsByTagName('parsererror')[0];

      if (parserError) {
        return alert(
          'A parser error was encounted. Are you sure the file is a valid GPX (XML) document?'
        );
      }
      const gpx = new GPX();
      const source = new VectorSource({
        format: gpx
      });
      const originalSource = new VectorSource({
        format: gpx
      });

      source.addFeatures(gpx.readFeatures(xmlDoc));
      originalSource.addFeatures(gpx.readFeatures(xmlDoc));

      actions.setSource([source, originalSource]);
      actions.simplifyGeo(state.tolerance);
    };
    reader.readAsText(file, 'utf8');
  },
  simplifyGeo: tolerance => (state, actions) => {
    const { source, originalSource } = state;

    const multiLineStringFeature = source
      .getFeatures()
      .find(feature => feature.getGeometry().getType() === MULTI_LINE_STRING);

    const multiLineStringFeatureOriginal = originalSource
      .getFeatures()
      .find(feature => feature.getGeometry().getType() === MULTI_LINE_STRING);

    const newTolerance = tolerance / 1000000;

    const sampledPoints = multiLineStringFeatureOriginal
      .getGeometry()
      .simplify(newTolerance);

    multiLineStringFeature.setGeometry(sampledPoints);

    debounce(() => {
      const xmlString = source.getFormat().writeFeatures(source.getFeatures());
      const xmlBlob = new Blob([xmlString], { type: 'application/gpx+xml' });
      actions.setXmlBlob(xmlBlob);
    }, 200)();
  },
  onToleranceChange: evt => (state, actions) => {
    const tolerance = evt.target.value;
    actions.simplifyGeo(tolerance);
    return {
      tolerance
    };
  },
  setSource: ([source, originalSource]) => () => {
    return {
      source,
      originalSource
    };
  },
  setXmlBlob: xmlBlob => () => {
    return {
      xmlBlob
    };
  },
  onDownloadButtonClick: () => state => {
    const { xmlBlob } = state;
    saveAs(xmlBlob, `test.gpx`);
  }
};

const view = (state, actions) => {
  const { source, originalSource, xmlBlob } = state;
  const multiLineCoords = getMultiLineCoords(source);
  const originalMultiLineCoords = getMultiLineCoords(originalSource);
  const coordsDiff =
    100 -
    Math.round((multiLineCoords.length / originalMultiLineCoords.length) * 100);
  return (
    <div class={c('Container')}>
      <form class={c('Form', pureForm, pureFormAligned)}>
        <h1 class={c('Form__heading')}>GPX Optimizer</h1>
        <p>
          Reduces the amount of trackpoints in GPX file using the
          Douglas–Peucker algorithm.
        </p>
        <div class={c(pureControlGroup)}>
          <label for="file">GPX File:</label>
          <input
            type="file"
            name="file"
            id="file"
            onchange={actions.onFileChange}
          />
        </div>
        {state.source && (
          <div>
            <div class={c(pureControlGroup)}>
              <label for="tolerance">Tolerance:</label>
              <input
                type="range"
                name="tolerance"
                id="tolerance"
                min="0"
                max="100"
                step="1"
                value={state.tolerance}
                oninput={actions.onToleranceChange}
              />
              <output
                id="tolerance-value"
                name="tolerance-value"
                for="tolerance"
              >
                {state.tolerance}
              </output>
            </div>
            <div class={c(pureControlGroup)}>
              <label>Total trackpoints:</label>
              <div class={c(pureFormMessageInline)}>
                {multiLineCoords.length} (-{coordsDiff}%)
              </div>
            </div>
            <div class={c(pureControlGroup)}>
              <label>Total file size:</label>
              {xmlBlob && (
                <div class={c(pureFormMessageInline)}>
                  {friendlyFileSize(xmlBlob.size)}{' '}
                </div>
              )}
            </div>
            <div class={c(pureControls)}>
              <button
                type="button"
                onclick={actions.onDownloadButtonClick}
                class={c(pureButton, pureButtonPrimary)}
              >
                Download
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
app(state, actions, view, document.body);
