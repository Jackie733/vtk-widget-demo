import { defineStore } from 'pinia';
import { useViewSliceStore } from './view-configs/slicing';
import useWindowingStore from './view-configs/windowing';
import { useImageStore } from './images';
import { StateFile, ViewConfig } from '../io/state-file/schema';

export const useViewConfigStore = defineStore('viewConfig', () => {
  const viewSliceStore = useViewSliceStore();
  const windowingStore = useWindowingStore();

  const removeView = (viewID: string) => {
    viewSliceStore.removeView(viewID);
    windowingStore.removeView(viewID);
  };

  const removeData = (dataID: string, viewID?: string) => {
    viewSliceStore.removeData(dataID, viewID);
    windowingStore.removeData(dataID, viewID);
  };

  const serialize = (stateFile: StateFile) => {
    viewSliceStore.serialize(stateFile);
    windowingStore.serialize(stateFile);
  };

  const deserialize = (
    viewID: string,
    config: Record<string, ViewConfig>,
    dataIDMap: Record<string, string>
  ) => {
    const updatedConfig: Record<string, ViewConfig> = {};
    Object.entries(config).forEach(([dataID, viewConfig]) => {
      const newDataID = dataIDMap[dataID];
      updatedConfig[newDataID] = viewConfig;
    });

    viewSliceStore.deserialize(viewID, updatedConfig);
    windowingStore.deserialize(viewID, updatedConfig);
  };

  // delete hook
  const imageStore = useImageStore();
  imageStore.$onAction(({ name, args }) => {
    if (name === 'deleteData') {
      const [id] = args;
      removeData(id);
    }
  });

  return {
    removeView,
    removeData,
    serialize,
    deserialize,
  };
});
