from .defaults import broker_transport_options, task_default_priority, task_default_queue

DEFAULT_CONFIG = {
    # 'task_queue_max_priority': 10,
    "worker_prefetch_multiplier": 1,
    "broker_transport_options": broker_transport_options,
    "task_default_priority": task_default_priority,
    "task_default_queue": task_default_queue,
}


class dict_wrapper(object):
    """Wraps a dict to convert `obj['attr']` to `obj.attr`."""

    def __init__(self, dictionary):
        self.__dict__ = dictionary
