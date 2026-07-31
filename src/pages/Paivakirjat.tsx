import { useState } from 'react';
import { motion } from 'framer-motion';

import { DiaryEditor } from './site-diaries/DiaryEditor';
import { DiaryList } from './site-diaries/DiaryList';

export default function Paivakirjat() {
  const [selectedDiaryId, setSelectedDiaryId] = useState<string | null>(null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {selectedDiaryId
        ? (
            <DiaryEditor
              diaryId={selectedDiaryId}
              onBack={() => setSelectedDiaryId(null)}
              onOpenDiary={setSelectedDiaryId}
            />
          )
        : <DiaryList onOpen={setSelectedDiaryId} />}
    </motion.div>
  );
}
