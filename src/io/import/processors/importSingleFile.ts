import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import { useImageStore } from '@/src/store/images';
import { FILE_READERS } from '@/src/io';
import { ImportHandler } from '@/src/io/import/common';
import { DataSourceWithFile } from '@/src/io/import/dataSource';
import { useFileStore } from '@/src/store/files';

/**
 * Reads and imports a file DataSource.
 * @param dataSource
 * @returns
 */
const importSingleFile: ImportHandler = async (dataSource, { done }) => {
  if (!dataSource.fileSrc) {
    return dataSource;
  }

  const { fileSrc } = dataSource;
  if (!FILE_READERS.has(fileSrc.fileType)) {
    return dataSource;
  }

  const reader = FILE_READERS.get(fileSrc.fileType)!;
  const dataObject = await reader(fileSrc.file);

  const fileStore = useFileStore();

  if (dataObject.isA('vtkImageData')) {
    const dataID = useImageStore().addVTKImageData(
      fileSrc.file.name,
      dataObject as vtkImageData
    );
    fileStore.add(dataID, [dataSource as DataSourceWithFile]);

    return done({
      dataID,
      dataSource,
      dataType: 'image',
    });
  }

  // if (dataObject.isA('vtkPolyData')) {
  //   if (!useDatasetStore().primarySelection) {
  //     useMessageStore().addWarning(
  //       'Load an image to see the mesh. Initializing viewports from mesh files is not implemented.'
  //     );
  //   }
  //   const dataID = useModelStore().addVTKPolyData(
  //     fileSrc.file.name,
  //     dataObject as vtkPolyData
  //   );
  //   fileStore.add(dataID, [dataSource as DataSourceWithFile]);

  //   return done({
  //     dataID,
  //     dataSource,
  //     dataType: 'model',
  //   });
  // }

  throw new Error('Data reader did not produce a valid dataset');
};

export default importSingleFile;
