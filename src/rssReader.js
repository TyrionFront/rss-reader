import { watch } from 'melanke-watchjs';
import i18next from 'i18next';
import _ from 'lodash'; // eslint-disable-line lodash-fp/use-fp
import resources from '../locales/descriptions';
import {
  processTypedUrl, processFormData, processSearch,
} from './processors';
import { makePostsList, makeFeedItem, displayHidePosts } from './htmlMakers';

export default () => {
  i18next.init({
    debug: true,
    lng: 'descriptions',
    defaultNS: 'errors',
    resources,
  });

  const appState = {
    form: {
      state: 'onInput',
      urlState: 'empty',
      url: '',
      responseStatus: '',
    },
    feeds: {
      state: 'not-updating',
      activeFeedId: '',
      timerId: '',
      list: [],
    },
    posts: {
      fresh: [],
      all: [],
    },
    search: {
      state: 'onInput',
      inputState: 'empty',
      selectedIds: new Set(),
    },
  };

  const mainTitles = document.getElementById('mainTitles');
  const content = document.getElementById('content');
  const addRssForm = document.getElementById('addRss');
  const [addLinkBtn, urlInputField] = addRssForm.elements;
  const warningNode = document.getElementById('wrongInput');
  const loadingIndicator = document.getElementById('linkLoading');
  const feedsListTag = document.getElementById('rssFeeds');
  const newsTag = document.getElementById('news');
  const searchInput = document.getElementById('newsSearch');
  const searchButton = document.getElementById('makeSearch');
  const feedsBadges = {};
  const feedElements = {};

  const getElement = (coll, ...ids) => {
    const tagId = ids.length > 1 ? `${ids.join('-')}` : ids;
    let htmlTag = coll[tagId];
    if (!htmlTag) {
      htmlTag = document.getElementById(tagId);
      coll[tagId] = htmlTag; // eslint-disable-line no-param-reassign
    }
    return htmlTag;
  };

  const markActiveFeed = ({ currentTarget }) => {
    const { activeFeedId } = appState.feeds;
    const currentId = currentTarget.id;
    appState.feeds.activeFeedId = activeFeedId !== currentId ? currentId : `sameFeed-${currentId}`;
  };

  watch(appState.form, 'urlState', () => {
    const { urlState } = appState.form;
    const [value, warning] = urlState.split(' ');
    warningNode.classList.add('d-none');
    urlInputField.className = 'form-control';
    addLinkBtn.disabled = true;
    switch (value) { // eslint-disable-line default-case
      case 'is-valid':
        urlInputField.classList.add(value);
        addLinkBtn.disabled = false;
        break;
      case 'is-invalid':
        urlInputField.classList.add(value);
        warningNode.innerText = i18next.t([`${warning}`, 'unspecific']);
        warningNode.classList.remove('d-none');
        break;
    }
  });

  watch(appState.form, 'state', () => {
    const { state, responseStatus } = appState.form;
    urlInputField.disabled = false;
    warningNode.classList.add('d-none');
    addLinkBtn.disabled = true;
    addLinkBtn.classList.replace('align-self-end', 'align-self-start');
    [...loadingIndicator.children].forEach(({ classList }) => classList.add('d-none'));
    switch (state) { // eslint-disable-line default-case
      case 'processing':
        [...loadingIndicator.children].forEach(({ classList }) => classList.remove('d-none'));
        urlInputField.disabled = true;
        urlInputField.className = 'form-control';
        addLinkBtn.classList.replace('align-self-start', 'align-self-end');
        break;
      case 'processed':
        urlInputField.value = '';
        mainTitles.classList.remove('d-none');
        content.classList.remove('d-none');
        break;
      case 'failed':
        warningNode.innerText = i18next.t([`${responseStatus}`, 'unspecific']);
        warningNode.classList.remove('d-none');
        break;
    }
  });

  watch(appState.feeds, 'list', () => {
    makeFeedItem(appState.feeds.list, feedsListTag, markActiveFeed);
  }, 1);

  watch(appState.posts, 'fresh', () => {
    const { fresh } = appState.posts;
    const [activeFeedId] = appState.feeds.activeFeedId.split('-');
    const [currentFeedId] = fresh;
    const { postsCount } = _.find(appState.feeds.list, ['feedId', currentFeedId]);
    const currentFeedBadge = getElement(feedsBadges, currentFeedId, 'badge');
    const postsList = makePostsList(fresh, activeFeedId, appState.search.selectedIds);
    newsTag.prepend(...postsList);
    currentFeedBadge.innerText = postsCount;
  });

  watch(appState.feeds, 'activeFeedId', () => {
    const { activeFeedId } = appState.feeds;
    const { selectedIds } = appState.search;
    const [activeIdValue, sameId] = activeFeedId.split('-');
    displayHidePosts(activeIdValue, [...newsTag.children], selectedIds);
    if (activeIdValue === 'sameFeed') {
      const currentFeedElem = feedElements[sameId];
      currentFeedElem.classList.toggle('active');
      return;
    }
    const currentFeed = getElement(feedElements, activeIdValue);
    const prevActiveFeed = _.find(feedElements, ({ classList }) => classList.contains('active'));
    const feedsPair = prevActiveFeed ? [currentFeed, prevActiveFeed] : [currentFeed];
    feedsPair.forEach(({ classList }) => classList.toggle('active'));
  });

  watch(appState.search, 'inputState', () => {
    const { search } = appState;
    searchInput.className = 'form-control ml-2';
    searchButton.disabled = true;
    switch (search.inputState) { // eslint-disable-line default-case
      case 'noMatches':
        searchInput.classList.add('is-invalid');
        break;
      case 'matched':
        searchInput.classList.add('is-valid');
        searchButton.disabled = false;
        break;
    }
  });

  watch(appState.search, 'state', () => {
    const { selectedIds, state } = appState.search;
    const [activeFeedId] = appState.feeds.activeFeedId.split('-');
    switch (state) { // eslint-disable-line default-case
      case 'empty':
        displayHidePosts(activeFeedId, [...newsTag.children], selectedIds);
        break;
      case 'hasValues':
        displayHidePosts(activeFeedId, [...newsTag.children], selectedIds);
        searchButton.disabled = true;
        break;
    }
  });

  urlInputField.addEventListener('input', ({ target }) => {
    const { value } = target;
    processTypedUrl(appState, value);
  });

  addRssForm.addEventListener('submit', (e) => {
    e.preventDefault();
    processFormData(appState);
  });

  searchInput.addEventListener('input', ({ target }) => {
    const { value } = target;
    processSearch(appState, value);
  });

  searchButton.addEventListener('click', (e) => {
    e.preventDefault();
    appState.search.state = 'hasValues';
  });
};
