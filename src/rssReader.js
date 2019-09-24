import axios from 'axios';
import { watch } from 'melanke-watchjs';
import validator from 'validator';
import parseResponse from './processors';
import moveForm from './htmlMakers';

export default () => {
  const appState = {
    links: {
      typedLink: {
        isEmpty: true,
        isValid: false,
      },
      lastValidUrl: '',
      lastAddedUrl: '',
      allAddedUrls: {},
    },
    warning: {
      input: {
        isExist: false,
        warningMessage: '',
      },
      refreshing: {
        isExist: false,
        warningMessage: '',
      },
    },
    feeds: {
      lastFeedId: '',
      workableUrls: new Set(),
      rssInfo: {},
      activeFeedId: '',
      prevActiveFeedId: '',
      items: {
        freshNews: new Map(),
        allNews: new Map(),
        refreshingCount: 0,
      },
      refreshingIsNotStarted: true,
    },
    rssFormState: {
      atTheBottom: false,
    },
  };

  const mainTitles = document.getElementById('mainTitles');
  const addRssForm = document.getElementById('addRss');
  const addLinkBtn = document.getElementById('confirm');
  const inputField = document.getElementById('urlField');
  const warningNode = document.getElementById('wrongInput');
  const loadingIndicator = document.getElementById('linkLoading');

  watch(appState.links, 'typedLink', () => {
    inputField.classList.toggle('is-invalid');
    addLinkBtn.disabled = !appState.links.typedLink.isValid;
  });

  watch(appState.links, 'allAddedUrls', () => {
    addLinkBtn.disabled = true;
    inputField.disabled = true;
    [...loadingIndicator.children].forEach(({ classList }) => classList.remove('d-none'));
    addLinkBtn.classList.replace('align-self-start', 'align-self-end');
  });

  watch(appState.links.typedLink, 'isValid', () => {
    inputField.classList.toggle('is-valid');
  });

  watch(appState.warning.input, 'isExist', () => {
    [...loadingIndicator.children].forEach(({ classList }) => classList.add('d-none'));
    addLinkBtn.classList.replace('align-self-end', 'align-self-start');
    warningNode.innerText = appState.warning.input.warningMessage;
    warningNode.classList.replace('d-none', 'd-inline');
    inputField.disabled = false;
  });

  watch(appState.warning.input, 'warningMessage', () => {
    warningNode.classList.replace('d-inline', 'd-none');
  });

  watch(appState.links, 'lastAddedUrl', () => {
    inputField.value = '';
    inputField.disabled = false;
    [...loadingIndicator.children].forEach(({ classList }) => classList.add('d-none'));
    addLinkBtn.classList.replace('align-self-end', 'align-self-start');
    mainTitles.classList.remove('d-none');
  });

  watch(appState.rssFormState, 'atTheBottom', () => {
    moveForm();
  });


  inputField.addEventListener('input', ({ target }) => {
    const { warningMessage } = appState.warning.input;
    if (warningMessage) {
      appState.warning.input.warningMessage = '';
    }
    const { value } = target;
    appState.links.typedLink.isEmpty = value.length === 0;
    const { allAddedUrls } = appState.links;
    const isLinkValid = validator.isURL(value) && allAddedUrls[value] !== 'visited';
    appState.links.typedLink.isValid = isLinkValid;
    if (isLinkValid) {
      appState.links.lastValidUrl = value;
    }
  });


  addRssForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const { lastValidUrl, allAddedUrls } = appState.links;

    if (allAddedUrls[lastValidUrl] !== 'visited') {
      appState.links.allAddedUrls = { ...allAddedUrls, [lastValidUrl]: 'visited' };
      axios.get(`https://cors-anywhere.herokuapp.com/${lastValidUrl}`)
        .then((response) => {
          const parsedData = parseResponse(response, 'application/xml');
          appState.links.lastAddedUrl = lastValidUrl;
          appState.links.typedLink.isEmpty = true;
          appState.links.typedLink.isValid = false;
          return parsedData;
        })
        .catch((err) => {
          if (!err.toString().includes('Refreshing')) {
            const { isExist } = appState.warning.input;
            appState.warning.input.warningMessage = 'No rss found at this URL';
            appState.links.typedLink.isValid = false;
            appState.warning.input.isExist = !isExist;
          }
          throw new Error(err);
        });
    }
  });
};
