export const ROLES = {
  werewolf: { id: 'werewolf', name: 'الذئب', team: 'wolves', teamName: 'فريق الذئاب', icon: '🐺', description: 'تستيقظ ليلاً مع قطيع الذئاب لاختيار ضحية من القرية، وفي النهار تتظاهر بالبراءة لتضليل الجميع.', night: 'الذئاب' },
  villager: { id: 'villager', name: 'القروي', team: 'village', teamName: 'فريق القرية', icon: '🧑‍🌾', description: 'ليس لديك قدرة خاصة في الليل؛ اعتمد على ذكائك وملاحظتك في النقاش النهاري لكشف الذئاب والتصويت ضدهم.', night: null },
  seer: { id: 'seer', name: 'العرافة', team: 'village', teamName: 'فريق القرية', icon: '🔮', description: 'تستيقظ كل ليلة وتختار لاعباً واحداً ليكشف لها الراوي بطاقته وهويته الحقيقية.', night: 'العرافة' },
  witch: { id: 'witch', name: 'الساحرة', team: 'village', teamName: 'فريق القرية', icon: '🧙‍♀️', description: 'تملك جرعتين فقط طوال اللعبة: جرعة حياة لإنقاذ ضحية الذئاب ليلاً، وجرعة سم لقتل أي لاعب تختاره.', night: 'الساحرة' },
  hunter: { id: 'hunter', name: 'الصياد', team: 'village', teamName: 'فريق القرية', icon: '🏹', description: 'إذا تم قتلك ليلاً أو إعدامك بالتصويت نهاراً، تطلق رصاصتك الأخيرة فوراً لتأخذ معك لاعباً آخر تختاره.', night: null },
  cupid: { id: 'cupid', name: 'كيوبيد', team: 'village', teamName: 'فريق القرية', icon: '💘', description: 'تستيقظ في الليلة الأولى فقط لربط لاعبين بسهم الحب؛ إذا مات أحدهما في أي مرحلة يموت الآخر معه فوراً.', night: 'كيوبيد · الليلة الأولى' },
  guard: { id: 'guard', name: 'المنقذ', team: 'village', teamName: 'فريق القرية', icon: '🛡️', description: 'تستيقظ كل ليلة لحماية لاعب واحد من هجوم الذئاب (لا يمكنك حماية نفس اللاعب ليلتين متتاليتين).', night: 'المنقذ' },
  little_girl: { id: 'little_girl', name: 'الفتاة الصغيرة', team: 'village', teamName: 'فريق القرية', icon: '👧', description: 'يمكنكِ فتح عينيكِ خلسة والتجسس أثناء استيقاظ الذئاب ليلاً، لكن إذا كشفكِ الذئاب تموتين فوراً.', night: 'تتجسس أثناء دور الذئاب' },
  traitor: { id: 'traitor', name: 'الخائن', team: 'wolves', teamName: 'فريق الذئاب', icon: '🗡️', description: 'أنت بشري لكنك في صف الذئاب وتفوز بفوزهم. لا تستيقظ معهم ليلاً، وإذا فحصتك العرافة تظهر كقروي بريء. مهمتك تضليل القرية وحماية الذئاب في النقاش.', night: null }
};

export const UNIQUE_ROLE_IDS = ['seer', 'witch', 'hunter', 'cupid', 'guard', 'little_girl', 'traitor'];
