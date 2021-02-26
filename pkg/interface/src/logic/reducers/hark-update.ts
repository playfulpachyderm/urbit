import {
  Notifications,
  NotifIndex,
  NotificationGraphConfig,
  GroupNotificationsConfig,
  UnreadStats,
  Timebox
} from '@urbit/api';
import { makePatDa } from '~/logic/lib/util';
import _ from 'lodash';
import { StoreState } from '../store/type';
import { BigIntOrderedMap } from '../lib/BigIntOrderedMap';
import useHarkState, { HarkState } from '../state/hark';
import { compose } from 'lodash/fp';

export const HarkReducer = (json: any) => {
  const data = _.get(json, 'harkUpdate', false);
  if (data) {
    reduce(data);
  }
  const graphHookData = _.get(json, 'hark-graph-hook-update', false);
  if (graphHookData) {
    useHarkState.setState(
      compose([
        graphInitial,
        graphIgnore,
        graphListen,
        graphWatchSelf,
        graphMentions,
      ].map(reducer => reducer.bind(reducer, graphHookData))
      )(useHarkState.getState())
    );
  }
  const groupHookData = _.get(json, 'hark-group-hook-update', false);
  if (groupHookData) {
    useHarkState.setState(
      compose([
        groupInitial,
        groupListen,
        groupIgnore,
      ].map(reducer => reducer.bind(reducer, groupHookData))
      )(useHarkState.getState())
    )
  }
};

function groupInitial(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'initial', false);
  if (data) {
    state.notificationsGroupConfig = data;
  }
  return state;
}

function graphInitial(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'initial', false);
  if (data) {
    state.notificationsGraphConfig = data;
  }
  return state;
}

function graphListen(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'listen', false);
  if (data) {
    state.notificationsGraphConfig.watching = [
      ...state.notificationsGraphConfig.watching,
      data
    ];
  }
  return state;
}

function graphIgnore(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'ignore', false);
  if (data) {
    state.notificationsGraphConfig.watching = state.notificationsGraphConfig.watching.filter(
      ({ graph, index }) => !(graph === data.graph && index === data.index)
    );
  }
  return state;
}

function groupListen(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'listen', false);
  if (data) {
    state.notificationsGroupConfig = [...state.notificationsGroupConfig, data];
  }
  return state;
}

function groupIgnore(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'ignore', false);
  if (data) {
    state.notificationsGroupConfig = state.notificationsGroupConfig.filter(
      n => n !== data
    );
  }
  return state;
}

function graphMentions(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'set-mentions', undefined);
  if (!_.isUndefined(data)) {
    state.notificationsGraphConfig.mentions = data;
  }
  return state;
}

function graphWatchSelf(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'set-watch-on-self', undefined);
  if (!_.isUndefined(data)) {
    state.notificationsGraphConfig.watchOnSelf = data;
  }
  return state;
}

function reduce(data: any) {
  useHarkState.setState(
    compose([
      unread,
      read,
      archive,
      timebox,
      more,
      dnd,
      added,
      unreads,
      readEach,
      readSince,
      unreadSince,
      unreadEach,
      seenIndex,
      removeGraph,
      readAll,
    ].map(reducer => reducer.bind(reducer, data))
    )(useHarkState.getState())
  );
}

function readAll(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'read-all');
  if(data) { 
    clearState(state);
  }
  return state;
}

function removeGraph(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'remove-graph');
  if(data) {
    delete state.unreads.graph[data];
  }
  return state;
}

function seenIndex(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'seen-index');
  if(data) {
    updateNotificationStats(state, data.index, 'last', () => data.time);
  }
  return state;
}

function readEach(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'read-each');
  if(data) {
    updateUnreads(state, data.index, u => u.delete(data.target));
  }
  return state;
}

function readSince(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'read-count');
  if(data) {
    updateUnreadCount(state, data, () => 0);
  }
  return state;
}

function unreadSince(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'unread-count');
  if(data) {
    updateUnreadCount(state, data.index, u => u + 1);
  }
  return state;
}

function unreadEach(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'unread-each');
  if(data) {
    updateUnreads(state, data.index, us => us.add(data.target));
  }
  return state;
}

function unreads(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'unreads');
  if(data) {
    clearState(state);
    data.forEach(({ index, stats }) => {
      const { unreads, notifications, last } = stats;
      updateNotificationStats(state, index, 'notifications', x => x + notifications);
      updateNotificationStats(state, index, 'last', () => last);
      if('count' in unreads) {
        updateUnreadCount(state, index, (u = 0) => u + unreads.count);
      } else {
        unreads.each.forEach((u: string) => {
          updateUnreads(state, index, s => s.add(u));
        });
      }
    });
  }
  return state;
}

function clearState(state: HarkState) {
  const initialState = {
    notifications: new BigIntOrderedMap<Timebox>(),
    archivedNotifications: new BigIntOrderedMap<Timebox>(),
    notificationsGroupConfig: [],
    notificationsGraphConfig: {
      watchOnSelf: false,
      mentions: false,
      watching: []
    },
    unreads: {
      graph: {},
      group: {}
    },
    notificationsCount: 0
  };

  Object.keys(initialState).forEach((key) => {
    state[key] = initialState[key];
  });
}

function updateUnreadCount(state: HarkState, index: NotifIndex, count: (c: number) => number) {
  if(!('graph' in index)) {
    return;
  }
  const property = [index.graph.graph, index.graph.index, 'unreads'];
  const curr = _.get(state.unreads.graph, property, 0);
  const newCount = count(curr);
  _.set(state.unreads.graph, property, newCount);
}

function updateUnreads(state: HarkState, index: NotifIndex, f: (us: Set<string>) => void) {
  if(!('graph' in index)) {
    return;
  }
  const unreads = _.get(state.unreads.graph, [index.graph.graph, index.graph.index, 'unreads'], new Set<string>());
  const oldSize = unreads.size;
  f(unreads);
  const newSize = unreads.size;
  _.set(state.unreads.graph, [index.graph.graph, index.graph.index, 'unreads'], unreads);
}

function updateNotificationStats(state: HarkState, index: NotifIndex, statField: 'notifications' | 'unreads' | 'last', f: (x: number) => number) {
    if(statField === 'notifications') {
      state.notificationsCount = f(state.notificationsCount);
    }
    if('graph' in index) {
      const curr = _.get(state.unreads.graph, [index.graph.graph, index.graph.index, statField], 0);
      _.set(state.unreads.graph, [index.graph.graph, index.graph.index, statField], f(curr));
    } else if('group' in index) {
      const curr = _.get(state.unreads.group, [index.group, statField], 0);
      _.set(state.unreads.group, [index.group, statField], f(curr));
    }
}

function added(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'added', false);
  if (data) {
    const { index, notification } = data;
    const time = makePatDa(data.time);
    const timebox = state.notifications.get(time) || [];

    const arrIdx = timebox.findIndex(idxNotif =>
      notifIdxEqual(index, idxNotif.index)
    );
    if (arrIdx !== -1) {
      if(timebox[arrIdx]?.notification?.read) {
        updateNotificationStats(state, index, 'notifications', x => x+1);
      }
      timebox[arrIdx] = { index, notification };
      state.notifications.set(time, timebox);
    } else {
      updateNotificationStats(state, index, 'notifications', x => x+1);
      state.notifications.set(time, [...timebox, { index, notification }]);
    }
  }
  return state;
}

const dnd = (json: any, state: HarkState): HarkState => {
  const data = _.get(json, 'set-dnd', undefined);
  if (!_.isUndefined(data)) {
    state.doNotDisturb = data;
  }
  return state;
};

const timebox = (json: any, state: HarkState): HarkState => {
  const data = _.get(json, 'timebox', false);
  if (data) {
    const time = makePatDa(data.time);
    if (!data.archive) {
      state.notifications.set(time, data.notifications);
    }
  }
  return state;
};

function more(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'more', false);
  if (data) {
    _.forEach(data, d => reduce(d, state));
  }
  return state;
}

function notifIdxEqual(a: NotifIndex, b: NotifIndex) {
  if ('graph' in a && 'graph' in b) {
    return (
      a.graph.graph === b.graph.graph &&
      a.graph.group === b.graph.group &&
      a.graph.module === b.graph.module &&
      a.graph.description === b.graph.description
    );
  } else if ('group' in a && 'group' in b) {
    return (
      a.group.group === b.group.group &&
      a.group.description === b.group.description
    );
  }
  return false;
}

function setRead(
  time: string,
  index: NotifIndex,
  read: boolean,
  state: HarkState
): HarkState {
  const patDa = makePatDa(time);
  const timebox = state.notifications.get(patDa);
  if (_.isNull(timebox)) {
    console.warn('Modifying nonexistent timebox');
    return state;
  }
  const arrIdx = timebox.findIndex(idxNotif =>
    notifIdxEqual(index, idxNotif.index)
  );
  if (arrIdx === -1) {
    console.warn('Modifying nonexistent index');
    return state;
  }
  timebox[arrIdx].notification.read = read;
  state.notifications.set(patDa, timebox);
  return state;
}

function read(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'read-note', false);
  if (data) {
    const { time, index } = data;
    updateNotificationStats(state, index, 'notifications', x => x-1);
    setRead(time, index, true, state);
  }
  return state;
}

function unread(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'unread-note', false);
  if (data) {
    const { time, index } = data;
    updateNotificationStats(state, index, 'notifications', x => x+1);
    setRead(time, index, false, state);
  }
  return state;
}

function archive(json: any, state: HarkState): HarkState {
  const data = _.get(json, 'archive', false);
  if (data) {
    const { index } = data;
    const time = makePatDa(data.time);
    const timebox = state.notifications.get(time);
    if (!timebox) {
      console.warn('Modifying nonexistent timebox');
      return state;
    }
    const [archived, unarchived] = _.partition(timebox, idxNotif =>
      notifIdxEqual(index, idxNotif.index)
    );
    if(unarchived.length === 0) {
      console.log('deleting entire timebox');
      state.notifications.delete(time);
    } else {
      state.notifications.set(time, unarchived);
    }
    const newlyRead = archived.filter(x => !x.notification.read).length;
    updateNotificationStats(state, index, 'notifications', x => x - newlyRead);
  }
  return state;
}
