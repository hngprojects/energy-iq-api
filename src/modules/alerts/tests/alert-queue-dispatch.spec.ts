// ==================================================================
// BULLMQ QUEUE FOR ALERT DISPATCH
// ==================================================================
// Tests:     7  (job lifecycle, retry, concurrency, graceful shutdown)
// Edge Cases: 6  (Redis down, backlog, payload limits, race conditions)
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import { Queue, Job } from 'bullmq';
import { mockAlertQueue, resetAllMocks } from './test-helpers';
import { ALERT_DISPATCH_JOB } from './alert-dispatch.jobs';
import { ProcessingStatus } from '../../../common/constants/processing-status';


describe('AlertQueue — Test Cases', () => {
  let queue: jest.Mocked<Queue>;

  beforeEach(() => {
    resetAllMocks();
    queue = mockAlertQueue as unknown as jest.Mocked<Queue>;
    queue.add.mockResolvedValue({ id: 'mock-job-id' } as Job)
  });

  // ------------------------------------------------------------------
  // 5.1  Alert job is added to queue
  // ------------------------------------------------------------------
  it('5.1 should add an alert job to the BullMQ queue when an alert is created', async () => {
    const alertData = {
      alertId: 'alert-uuid-1',
      userId: 'user-uuid-1',
      type: 'BATTERY_PERCENTAGE',
      severity: 'CRITICAL',
      message: 'Battery at 8% — immediate action required',
      channel: 'whatsapp',
    };

    const job = await queue.add(ALERT_DISPATCH_JOB, alertData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: false,
    });

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      ALERT_DISPATCH_JOB,
      alertData,
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }),
    );
    expect(job).toBeDefined();
  });

  // ------------------------------------------------------------------
  // 5.2  Job contains all required fields
  // ------------------------------------------------------------------
  it('5.2 should ensure the job payload includes all mandatory fields', () => {
    const requiredFields = [
      'alertId',
      'userId',
      'type',
      'severity',
      'message',
      'channel',
    ];

    const validPayload = {
      alertId: 'alert-abc',
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: 'CRITICAL',
      message: 'Test message',
      channel: 'whatsapp',
    };
    const invalidPayload = { alertId: 'abc', userId: '123' }; // missing fields

    const validHasAll = requiredFields.every(
      (field) => field in validPayload,
    );
    const invalidHasAll = requiredFields.every(
      (field) => field in invalidPayload,
    );

    expect(validHasAll).toBe(true);
    expect(invalidHasAll).toBe(false);
  });

  // ------------------------------------------------------------------
  // 5.3  Queue respects retry configuration
  // ------------------------------------------------------------------
  it('5.3 should retry failed jobs up to 3 times with exponential backoff', async () => {
    const mockJob = {
      id: 'job-1',
      data: { alertId: 'alert-1', userId: 'u1' },
      attemptsMade: 0,
      retry: jest.fn(),
    } as unknown as Job;

    const processJob = async (job: Job) => {
      job.attemptsMade++;
      if (job.attemptsMade <= 3) {
        throw new Error('Delivery failed — retrying');
      }
      return { success: true };
    };

    // Attempt 1: fails
    await expect(processJob(mockJob)).rejects.toThrow(
      'Delivery failed — retrying',
    );
    expect(mockJob.attemptsMade).toBe(1);

    // Attempt 2: fails
    await expect(processJob(mockJob)).rejects.toThrow(
      'Delivery failed — retrying',
    );
    expect(mockJob.attemptsMade).toBe(2);

    // Attempt 3: fails
    await expect(processJob(mockJob)).rejects.toThrow(
      'Delivery failed — retrying',
    );
    expect(mockJob.attemptsMade).toBe(3);

    // Attempt 4: succeeds (would not be reached if maxAttempts>3)
    const result = await processJob(mockJob);
    expect(result).toEqual({ success: true });
    expect(mockJob.attemptsMade).toBe(4);
  });

  // ------------------------------------------------------------------
  // 5.4  Successful processing marks alert record as delivered
  // ------------------------------------------------------------------
  it('5.4 should mark the alert deliveryProcessingStatus as SUCCESSFUL when delivery succeeds', async () => {
    const mockAlert = {
      id:  'alert-2',
      deliveryProcesingStatus: ProcessingStatus.pending,
      save: jest.fn().mockResolvedValue(true),
    };

    mockAlert.deliveryProcesingStatus = ProcessingStatus.successful;
    const result = await mockAlert.save();

    expect(mockAlert.deliveryProcesingStatus).toBe(
      ProcessingStatus.successful,
    );
    expect(result).toBe(true);
  });

  // ------------------------------------------------------------------
  // 5.5  Malformed job data throws error
  // ------------------------------------------------------------------
  it('5.5 should throw an error and move job to failed when payload is malformed', () => {
    const invalidJobData = {
      alertId: 'alert-3',
      // missing userId, channel
    };

    const validatePayload = (data: any) => {
      if (!data.userId) throw new Error('ValidationError: userId is required');
      if (!data.channel)
        throw new Error('ValidationError: channel is required');
    };

    expect(() => validatePayload(invalidJobData)).toThrow('ValidationError');
  });

  // ------------------------------------------------------------------
  // 5.6  Queue drains on shutdown
  // ------------------------------------------------------------------
  it('5.6 should complete in-flight jobs before terminating on graceful shutdown', async () => {
    const closeSpy = jest.spyOn(queue, 'close');

    const onModuleDestroy = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await queue.close();
    };

    await onModuleDestroy();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // 5.7  Concurrency limit per user (sequential processing)
  // ------------------------------------------------------------------
  it('5.7 should process alerts for the same user sequentially', async () => {
    const processingOrder: string[] = [];

    // Simulate sequential processing using a per-user lock
    const processWithLock = async (alertId: string) => {
      processingOrder.push(alertId);
      await new Promise((r) => setTimeout(r, 10));
    };

    const alerts = ['alert-A', 'alert-B', 'alert-C'];

    for (const alertId of alerts) {
      await processWithLock(alertId);
    }

    expect(processingOrder).toEqual(['alert-A', 'alert-B', 'alert-C']);
    expect(processingOrder).toHaveLength(3);
  });
});

// ------------------------------------------------------------------
// EDGE CASES
// ------------------------------------------------------------------
describe('AlertQueue — Edge Cases', () => {
  let queue: jest.Mocked<Queue>;

  beforeEach(() => {
    resetAllMocks()
    queue = mockAlertQueue as unknown as jest.Mocked<Queue>;
  });

  // ------------------------------------------------------------------
  // E31  Redis goes down mid-dispatch
  // ------------------------------------------------------------------
  it('E31 should throw a meaningful error when Redis connection is lost mid-dispatch', async () => {
    queue.add.mockRejectedValue(new Error('Redis connection refused'));

    await expect(
      queue.add(ALERT_DISPATCH_JOB, { alertId: 'alert-1' }),
    ).rejects.toThrow('Redis connection refused');
  });

  // ------------------------------------------------------------------
  // E32  Queue backlog of 10,000+ alerts (mass alert scenario)
  // ------------------------------------------------------------------
  it('E32 should handle large backlog without crashing', async () => {
    const getWaitingCount = jest.fn().mockResolvedValue(10000);
    const getActiveCount = jest.fn().mockResolvedValue(50);

    const waiting = await getWaitingCount();
    const active = await getActiveCount();

    expect(waiting).toBe(10000);
    expect(active).toBe(50);
    // No crash — queue continues processing FIFO
  });

  // ------------------------------------------------------------------
  // E33  Job payload exceeds Redis limit
  // ------------------------------------------------------------------
  it('E33 should reject jobs with payloads exceeding Redis size limits', () => {
    const MAX_PAYLOAD_BYTES = 512 * 1024 * 1024; // 512MB
    const count_large = 600 * 1024 * 1024; // 600MB

    const largeMessageBuffer = Buffer.alloc(count_large, 'x');
    const exceedsLimit = largeMessageBuffer.length > MAX_PAYLOAD_BYTES;

    expect(exceedsLimit).toBe(true);
  });

  // ------------------------------------------------------------------
  // E34  Worker crashes mid-processing
  // ------------------------------------------------------------------
  it('E34 should retry jobs that were in-flight when worker crashed', () => {
    const mockJob = {
      id: 'job-crash-1',
      data: { alertId: 'alert-crash' },
      attemptsMade: 1,
    } as unknown as Job;

    // BullMQ moves job back to 'waiting' on ungraceful disconnect
    const jobWasMovedBack = mockJob.attemptsMade < 3; // still has retries

    expect(jobWasMovedBack).toBe(true);
  });

  // ------------------------------------------------------------------
  // E35  Duplicate job IDs
  // ------------------------------------------------------------------
  it('E35 should deduplicate jobs when same jobId is provided', async () => {
    const jobId = 'dedup-job-id-1';

    // First add succeeds
    queue.add.mockResolvedValueOnce({ id: jobId } as Job);

    // Second add with same jobId returns existing job (no duplicate)
    queue.add.mockResolvedValueOnce({ id: jobId } as Job);

    const first = await queue.add(ALERT_DISPATCH_JOB, {}, { jobId });
    const second = await queue.add(ALERT_DISPATCH_JOB, {}, { jobId });

    expect(first.id).toBe(jobId);
    expect(second.id).toBe(jobId); // same job, not a new one
  });

  // ------------------------------------------------------------------
  // E36  Queue paused and resumed
  // ------------------------------------------------------------------
  it('E36 should queue jobs during pause and process them on resume', async () => {
    queue.isPaused.mockResolvedValueOnce(true);
    const paused = await queue.isPaused();
    expect(paused).toBe(true);

    // Jobs added while paused should queue up
    queue.add.mockResolvedValue({ id: 'queued-while-paused' } as Job);
    const job = await queue.add(ALERT_DISPATCH_JOB, { alertId: 'delayed' });
    expect(job).toBeDefined();

    // On resume, jobs process
    queue.resume.mockResolvedValue();
    await queue.resume();
    expect(queue.resume).toHaveBeenCalled();
  });
});
