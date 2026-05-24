use std::sync::{Mutex, OnceLock};

use ort::environment::Environment;
use ort::error::Result as OrtResult;
use ort::memory::{AllocationDevice, AllocatorType, MemoryInfo, MemoryType};
use ort::session::RunOptions;
use ort::{ortsys, AsPointer};

const RUN_OPTIONS_ENABLE_MEMORY_ARENA_SHRINKAGE: &str = "memory.enable_memory_arena_shrinkage";
const RUN_OPTIONS_CPU_ARENA_SHRINKAGE_TARGET: &str = "cpu:0";
const ARENA_EXTEND_STRATEGY_SAME_AS_REQUESTED: i32 = 1;

static BALANCED_CPU_ARENA: OnceLock<Mutex<Option<OrtResult<()>>>> = OnceLock::new();

pub fn register_balanced_cpu_arena() -> OrtResult<()> {
    let slot = BALANCED_CPU_ARENA.get_or_init(|| Mutex::new(None));
    let mut guard = slot
        .lock()
        .expect("balanced CPU arena registration lock poisoned");
    if guard.is_none() {
        *guard = Some(register_balanced_cpu_arena_inner());
    }
    match guard
        .as_ref()
        .expect("balanced CPU arena registration state missing")
    {
        Ok(()) => Ok(()),
        Err(err) => Err(ort::Error::new(err.to_string())),
    }
}

fn register_balanced_cpu_arena_inner() -> OrtResult<()> {
    let env = Environment::current()?;
    let memory_info = MemoryInfo::new(
        AllocationDevice::CPU,
        0,
        AllocatorType::Arena,
        MemoryType::Default,
    )?;

    let mut arena_cfg = std::ptr::null_mut();
    ortsys![unsafe CreateArenaCfg(
        0,
        ARENA_EXTEND_STRATEGY_SAME_AS_REQUESTED,
        -1,
        -1,
        &mut arena_cfg
    )?; nonNull(arena_cfg)];

    ortsys![unsafe CreateAndRegisterAllocator(
        env.ptr().cast_mut(),
        memory_info.ptr(),
        arena_cfg.as_ptr()
    )?];

    ortsys![unsafe ReleaseArenaCfg(arena_cfg.as_ptr())];
    Ok(())
}

pub fn inference_run_options() -> OrtResult<RunOptions> {
    let mut run_options = RunOptions::new()?;
    run_options.add_config_entry(
        RUN_OPTIONS_ENABLE_MEMORY_ARENA_SHRINKAGE,
        RUN_OPTIONS_CPU_ARENA_SHRINKAGE_TARGET,
    )?;
    Ok(run_options)
}
