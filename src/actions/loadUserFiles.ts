import { partitionResults, PipelineResultSuccess } from '../core/pipeline';
import {
  ImportResult,
  isLoadableResult,
  isVolumeResult,
  LoadableResult,
} from '../io/import/common';
import {
  DataSource,
  fileToDataSource,
  getDataSourceName,
} from '../io/import/dataSource';
import {
  importDataSources,
  ImportDataSourcesResult,
  toDataSelection,
} from '../io/import/importDataSources';
import { useDatasetStore } from '../store/datasets';
import { useDICOMStore } from '../store/dicom';
import useLoadDataStore from '../store/load-data';
import { nonNullable } from '../utils';
import { logError } from '../utils/loggers';

// higher value priority is preferred for picking a primary selection
const BASE_MODALITY_TYPES = {
  CT: { priority: 3 },
  MR: { priority: 3 },
  US: { priority: 2 },
  DX: { priority: 1 },
} as const;

function findBaseDicom(loadableDataSources: Array<LoadableResult>) {
  // find dicom dataset for primary selection if available
  const dicoms = loadableDataSources.filter(
    ({ dataType }) => dataType === 'dicom'
  );
  // prefer some modalities as base
  const dicomStore = useDICOMStore();
  const baseDicomVolumes = dicoms
    .map((dicomSource) => {
      const volumeInfo = dicomStore.volumeInfo[dicomSource.dataID];
      const modality = volumeInfo?.Modality as keyof typeof BASE_MODALITY_TYPES;
      if (modality in BASE_MODALITY_TYPES)
        return {
          dicomSource,
          priority: BASE_MODALITY_TYPES[modality]?.priority,
          volumeInfo,
        };
      return undefined;
    })
    .filter(nonNullable)
    .sort(
      (
        { priority: a, volumeInfo: infoA },
        { priority: b, volumeInfo: infoB }
      ) => {
        const priorityDiff = a - b;
        if (priorityDiff !== 0) return priorityDiff;
        // same modality, then more slices preferred
        if (!infoA.NumberOfSlices) return 1;
        if (!infoB.NumberOfSlices) return -1;
        return infoB.NumberOfSlices - infoA.NumberOfSlices;
      }
    );
  if (baseDicomVolumes.length) return baseDicomVolumes[0].dicomSource;
  return undefined;
}

function isSegmentation(extension: string, name: string) {
  if (!extension) return false; // avoid 'foo..bar' if extension is ''
  const extensions = name.split('.').slice(1);
  return extensions.includes(extension);
}

// does not pick segmentation images
function findBaseImage(
  loadableDataSources: Array<LoadableResult>,
  segmentGroupExtension: string
) {
  const baseImages = loadableDataSources
    .filter(({ dataType }) => dataType === 'image')
    .filter((importResult) => {
      const name = getDataSourceName(importResult.dataSource);
      if (!name) return false;
      return !isSegmentation(segmentGroupExtension, name);
    });

  if (baseImages.length) return baseImages[0];
  return undefined;
}

// returns image and dicom sources, no config files
function filterLoadableDataSources(
  succeeded: Array<PipelineResultSuccess<ImportResult>>
) {
  return succeeded.flatMap((result) => {
    return result.data.filter(isLoadableResult);
  });
}

function findBaseDataSource(
  succeeded: Array<PipelineResultSuccess<ImportResult>>,
  segmentGroupExtension: string
) {
  const loadableDataSources = filterLoadableDataSources(succeeded);
  const baseDicom = findBaseDicom(loadableDataSources);
  if (baseDicom) return baseDicom;

  const baseImage = findBaseImage(loadableDataSources, segmentGroupExtension);
  if (baseImage) return baseImage;
  return loadableDataSources[0];
}

function loadDataSources(sources: DataSource[]) {
  const load = async () => {
    const loadDataStore = useLoadDataStore();
    const dataStore = useDatasetStore();

    let results: ImportDataSourcesResult[] = [];
    try {
      results = await importDataSources(sources);
    } catch (error) {
      loadDataStore.setError(error as Error);
      return;
    }

    const [succeeded, errored] = partitionResults(results);

    if (!dataStore.primarySelection && succeeded.length) {
      const primaryDataSource = findBaseDataSource(
        succeeded,
        loadDataStore.segmentGroupExtension
      );

      if (isVolumeResult(primaryDataSource)) {
        const selection = toDataSelection(primaryDataSource);
        dataStore.setPrimarySelection(selection);
        // loadLayers(primaryDataSource, succeeded);
        // loadSegmentations(
        //   primaryDataSource,
        //   succeeded,
        //   loadDataStore.segmentGroupExtension
        // );
      } // then must be primaryDataSource.type === 'model'
    }

    if (errored.length) {
      const errorMessages = errored.map((errResult) => {
        // pick first error
        const [firstError] = errResult.errors;
        // pick innermost dataset that errored
        const name = getDataSourceName(firstError.inputDataStackTrace[0]);
        // log error for debugging
        logError(firstError.cause);
        return `- ${name}: ${firstError.message}`;
      });
      const failedError = new Error(
        `These files failed to load:\n${errorMessages.join('\n')}`
      );

      loadDataStore.setError(failedError);
    }
  };

  const wrapWithLoading = <T extends (...args: any[]) => void>(fn: T) => {
    const { startLoading, stopLoading } = useLoadDataStore();
    return async function wrapper(...args: any[]) {
      try {
        startLoading();
        await fn(...args);
      } finally {
        stopLoading();
      }
    };
  };

  return wrapWithLoading(load)();
}

export async function loadFiles(files: File[]) {
  const dataSources = files.map(fileToDataSource);
  return loadDataSources(dataSources);
}
